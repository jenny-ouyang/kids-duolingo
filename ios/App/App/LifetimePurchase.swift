import Foundation
import StoreKit
import Capacitor

/// The iPhone lifetime unlock (spec 2026-10-13 §6). StoreKit 2, no third party.
/// JS side: lib/purchase-native.ts. Every signed transaction (JWS) goes to
/// POST /api/apple/verify, which grants the unlock; this plugin never decides
/// access on its own.
///
/// In-app plugin, not an npm package, so Capacitor 8 does not find it through
/// packageClassList. MainViewController (SceneDelegate.swift) registers it in
/// capacitorDidLoad() with bridge?.registerPluginInstance(...).
@objc(LifetimePurchasePlugin)
public class LifetimePurchasePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LifetimePurchasePlugin"
    public let jsName = "LifetimePurchase"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProduct", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
    ]

    static let productId = "com.mandarineer.app.lifetime"

    private var updatesTask: Task<Void, Never>?

    override public func load() {
        // Purchases that finish outside a Buy tap: Ask to Buy approved later,
        // or a purchase interrupted when the app closed. retainUntilConsumed
        // keeps the event until the Parent Zone card adds its listener.
        updatesTask = Task.detached { [weak self] in
            for await result in Transaction.updates {
                guard case .verified(let tx) = result, tx.productID == LifetimePurchasePlugin.productId else { continue }
                await tx.finish()
                await self?.emitPurchaseUpdated(result.jwsRepresentation)
            }
        }
    }

    @MainActor private func emitPurchaseUpdated(_ jws: String) {
        notifyListeners("purchaseUpdated", data: ["jws": jws], retainUntilConsumed: true)
    }

    deinit {
        updatesTask?.cancel()
    }

    /// TestFlight and App Review run against the StoreKit sandbox. Read from the
    /// receipt URL so no App Store sign-in prompt can appear.
    private static func storeEnvironment() -> String {
        Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt" ? "sandbox" : "production"
    }

    /// { product?: { id, displayPrice }, environment }. displayPrice is Apple's localized price.
    @objc func getProduct(_ call: CAPPluginCall) {
        Task {
            var data: [String: Any] = ["environment": LifetimePurchasePlugin.storeEnvironment()]
            if let product = try? await Product.products(for: [LifetimePurchasePlugin.productId]).first {
                data["product"] = ["id": product.id, "displayPrice": product.displayPrice]
            }
            call.resolve(data)
        }
    }

    /// { status: 'ok', jws } | { status: 'pending' } | { status: 'cancelled' }
    @objc func purchase(_ call: CAPPluginCall) {
        Task {
            do {
                guard let product = try await Product.products(for: [LifetimePurchasePlugin.productId]).first else {
                    call.reject("The product is not available")
                    return
                }
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    guard case .verified(let tx) = verification else {
                        call.reject("The App Store could not verify the purchase")
                        return
                    }
                    // Non-consumable: it stays in currentEntitlements after
                    // finish(), so Restore Purchases covers a failed server call.
                    await tx.finish()
                    call.resolve(["status": "ok", "jws": verification.jwsRepresentation])
                case .pending:
                    call.resolve(["status": "pending"])
                case .userCancelled:
                    call.resolve(["status": "cancelled"])
                @unknown default:
                    call.resolve(["status": "cancelled"])
                }
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    /// { jws: string[] } — every current entitlement for our product,
    /// including a family-shared copy.
    @objc func restore(_ call: CAPPluginCall) {
        Task {
            // Apple's recommended Restore: sync with the App Store first. A
            // cancelled sign-in is fine; the local entitlements are still read.
            try? await AppStore.sync()
            var list: [String] = []
            for await result in Transaction.currentEntitlements {
                if case .verified(let tx) = result,
                   tx.productID == LifetimePurchasePlugin.productId,
                   tx.revocationDate == nil {
                    list.append(result.jwsRepresentation)
                }
            }
            call.resolve(["jws": list])
        }
    }
}
