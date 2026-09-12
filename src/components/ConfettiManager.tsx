import { useEffect, useState } from "react";
import Confetti from "react-confetti";
import { useAppStore } from "../store/useAppStore";
import { ACHIEVEMENTS } from "../constants/achievements";

export function ConfettiManager() {
  const { tutorialsSeen, userStats, hasSeenAllAchievementsConfetti, setHasSeenAllAchievementsConfetti, setActiveTab } = useAppStore();
  const [trigger, setTrigger] = useState(false);
  const [windowDimension, setWindowDimension] = useState({ width: window.innerWidth, height: window.innerHeight });

  const detectSize = () => {
    setWindowDimension({ width: window.innerWidth, height: window.innerHeight });
  }

  useEffect(() => {
    window.addEventListener('resize', detectSize);
    return () => {
      window.removeEventListener('resize', detectSize);
    }
  }, []);

  useEffect(() => {
    // We pass `seenCount` to achievement.getProgress because some achievements use it
    const seenCount = Object.values(tutorialsSeen).filter(Boolean).length;
    
    let unlockedCount = 0;
    for (const achievement of ACHIEVEMENTS) {
      if (achievement.getProgress(userStats, seenCount) >= achievement.target) {
        unlockedCount++;
      }
    }

    if (unlockedCount === ACHIEVEMENTS.length && !hasSeenAllAchievementsConfetti) {
      requestAnimationFrame(() => {
        setTrigger(true);
        setHasSeenAllAchievementsConfetti(true);
        setActiveTab("achievements");
      });
    }
  }, [tutorialsSeen, userStats, hasSeenAllAchievementsConfetti, setHasSeenAllAchievementsConfetti, setActiveTab]);

  if (!trigger) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      <Confetti
        width={windowDimension.width}
        height={windowDimension.height}
        recycle={false}
        numberOfPieces={800}
        gravity={0.12}
        initialVelocityY={20}
      />
    </div>
  );
}
