import { useEffect, useState } from 'react'

export function useSecondsSince(baseTime: Date) {
  const [seconds, setSeconds] = useState(() =>
    Math.floor((Date.now() - baseTime.getTime()) / 1000),
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(Math.floor((Date.now() - baseTime.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [baseTime])

  return seconds
}

export function useCyclingIndex(length: number, intervalMs = 2800) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (length <= 1) return
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % length)
    }, intervalMs)
    return () => clearInterval(interval)
  }, [length, intervalMs])

  return index
}

export function formatObservationCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)} millones`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return count.toString()
}
