'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { loadProgress, saveProgress, unlockPack } from '@/lib/progress'
import { getMasteryPercent } from '@/lib/spaced-repetition'
import { ChildProgress } from '@/lib/types'

interface PackMeta {
  id: string
  name: string
  nameZh: string
  emoji: string
  color: string
  wordCount: number
}

export default function ParentDashboard() {
  const router = useRouter()
  const [progress, setProgress] = useState<ChildProgress | null>(null)
  const [packs, setPacks] = useState<PackMeta[]>([])
  const [resetConfirm, setResetConfirm] = useState(false)

  useEffect(() => {
    setProgress(loadProgress())
    fetch('/api/packs')
      .then((r) => r.json())
      .then(setPacks)
  }, [])

  function handleUnlock(packId: string) {
    unlockPack(packId)
    setProgress(loadProgress())
  }

  function handleLock(packId: string) {
    const current = loadProgress()
    if (current.packs[packId]) {
      current.packs[packId].unlocked = false
      saveProgress(current)
      setProgress(loadProgress())
    }
  }

  function handleReset() {
    if (!resetConfirm) {
      setResetConfirm(true)
      return
    }
    localStorage.removeItem('julian-progress')
    setProgress(loadProgress())
    setResetConfirm(false)
  }

  if (!progress) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-4xl animate-spin">⏳</div>
      </div>
    )
  }

  const totalWordsLearned = Object.values(progress.packs).reduce(
    (acc, pack) => acc + Object.values(pack.words).filter((w) => w.repetitions >= 1).length,
    0
  )
  const totalWordsMastered = Object.values(progress.packs).reduce(
    (acc, pack) => acc + Object.values(pack.words).filter((w) => w.repetitions >= 3).length,
    0
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-gray-600 hover:bg-gray-100 transition-colors font-medium"
          >
            ← Home
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Parent Dashboard</h1>
            <p className="text-gray-500 text-sm">Julian&apos;s learning progress</p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-3xl font-extrabold text-blue-600">{totalWordsLearned}</p>
            <p className="text-gray-500 text-sm mt-1">Words practiced</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-3xl font-extrabold text-green-600">{totalWordsMastered}</p>
            <p className="text-gray-500 text-sm mt-1">Words mastered (3+ reviews)</p>
          </div>
        </div>

        {/* Pack management */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-gray-700">Vocabulary Packs</h2>
          {packs.map((pack) => {
            const packProgress = progress.packs[pack.id]
            const unlocked = packProgress?.unlocked ?? pack.id === 'animals'
            const masteryPct = getMasteryPercent(
              Object.keys(packProgress?.words ?? {}),
              packProgress?.words ?? {}
            )
            const practiced = Object.keys(packProgress?.words ?? {}).length

            return (
              <motion.div
                key={pack.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: pack.color + '33' }}
                >
                  {pack.emoji}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">{pack.name}</span>
                    <span className="text-gray-400 text-sm">{pack.nameZh}</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {practiced} / {pack.wordCount} words practiced · {masteryPct}% mastered
                  </div>
                  {/* Mini progress bar */}
                  <div className="mt-2 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-400 transition-all duration-500"
                      style={{ width: `${masteryPct}%` }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => (unlocked ? handleLock(pack.id) : handleUnlock(pack.id))}
                  disabled={pack.id === 'animals'}
                  className={`flex-shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                    pack.id === 'animals'
                      ? 'bg-gray-100 text-gray-400 cursor-default'
                      : unlocked
                      ? 'bg-red-50 text-red-500 hover:bg-red-100'
                      : 'bg-green-50 text-green-600 hover:bg-green-100'
                  }`}
                >
                  {pack.id === 'animals' ? 'Default' : unlocked ? 'Lock 🔒' : 'Unlock 🔓'}
                </button>
              </motion.div>
            )
          })}
        </div>

        {/* Next review info */}
        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
          <h2 className="font-bold text-blue-800 mb-2">About Spaced Repetition</h2>
          <p className="text-blue-700 text-sm leading-relaxed">
            Julian&apos;s progress uses the SM-2 algorithm. Words he gets right are shown less
            frequently over time. Words he struggles with come back sooner. After 3 correct
            reviews, a word is considered &quot;mastered.&quot;
          </p>
        </div>

        {/* Reset progress */}
        <div className="border-t border-gray-200 pt-6">
          <button
            onClick={handleReset}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              resetConfirm
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {resetConfirm ? 'Confirm Reset All Progress' : 'Reset All Progress'}
          </button>
          {resetConfirm && (
            <p className="text-red-500 text-xs mt-1">
              This will delete all of Julian&apos;s progress. Click again to confirm.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
