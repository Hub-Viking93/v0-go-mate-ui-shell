

import { useEffect, useState } from "react"

interface ConfettiPiece {
  id: number
  x: number
  color: string
  delay: number
  duration: number
  size: number
}

interface ConfettiProps {
  active: boolean
  onComplete?: () => void
}

export function Confetti({ active, onComplete }: ConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])
  
  useEffect(() => {
    if (!active) {
      setPieces([])
      return
    }
    
    // Generate confetti pieces
    const colors = [
      "hsl(var(--primary))",
      "hsl(var(--chart-1))",
      "hsl(var(--chart-2))",
      "hsl(var(--chart-3))",
      "hsl(var(--chart-4))",
      "#FFD700", // gold
      "#FF6B6B", // coral
      "#4ECDC4", // teal
    ]
    
    const newPieces: ConfettiPiece[] = []
    for (let i = 0; i < 100; i++) {
      newPieces.push({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 2,
        size: 6 + Math.random() * 6,
      })
    }
    setPieces(newPieces)
    
    // Clear after animation
    const timer = setTimeout(() => {
      setPieces([])
      onComplete?.()
    }, 4000)
    
    return () => clearTimeout(timer)
  }, [active, onComplete])
  
  if (!active || pieces.length === 0) return null
  
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute animate-confetti"
          style={{
            left: `${piece.x}%`,
            top: "-20px",
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti-fall ease-out forwards;
        }
      `}</style>
    </div>
  )
}
