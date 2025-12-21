import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding: Beats Abacus 2.0');

  const moduleDefs: {
    index: number;
    title: string;
    summary: string;
    skillFocus: string;
  }[] = [
    // Level 1 – Foundations
    {
      index: 1,
      title: 'L1M1: Beats Frame & Visualization Basics',
      summary:
        'Introduce the Beats hybrid frame, color-coded rods, and dual-layer beads with basic visualization.',
      skillFocus: 'Frame orientation, rod identification, visual mapping of beads.',
    },
    {
      index: 2,
      title: 'L1M2: Units & Tens Formation',
      summary: 'Build stable understanding of unit and tens values using the Beats frame.',
      skillFocus: 'Place-value sense for units and tens, accurate bead formation.',
    },
    {
      index: 3,
      title: 'L1M3: Single-Digit Add/Sub Intro',
      summary: 'First exposure to single-digit addition and subtraction with strong frame discipline.',
      skillFocus: 'Single-digit operations, hand movement discipline, accuracy over speed.',
    },

    // Level 2 – Speed Operations
    {
      index: 4,
      title: 'L2M1: Single-Digit Speed Drills',
      summary: 'Convert accurate single-digit operations into time-bound speed drills.',
      skillFocus: 'Speed, rhythm, reduction of micro-pauses in basic sums.',
    },
    {
      index: 5,
      title: 'L2M2: Two-Digit Addition (No Carry)',
      summary: 'Introduce 2-digit addition without carry to stabilize multi-digit vertical/horizontal layouts.',
      skillFocus: 'Multi-digit alignment, controlled finger transitions.',
    },
    {
      index: 6,
      title: 'L2M3: Two-Digit Subtraction (No Borrow)',
      summary: 'Mirror 2-digit addition with structured subtraction without borrow.',
      skillFocus: 'Reverse operations, subtraction confidence, error awareness.',
    },

    // Level 3 – Pattern Mastery
    {
      index: 7,
      title: 'L3M1: Number Grouping & Patterns',
      summary: 'Teach grouping strategies and repeated patterns to reduce cognitive load.',
      skillFocus: 'Pattern recognition, chunking, mental grouping.',
    },
    {
      index: 8,
      title: 'L3M2: Complement & 5-Based Patterns',
      summary: 'Introduce complements and 5-based patterns on the hybrid frame.',
      skillFocus: 'Complement logic, 5-combo style transitions, structured jumps.',
    },
    {
      index: 9,
      title: 'L3M3: 10-Based Jump Patterns',
      summary: 'Extend pattern thinking into 10-based jumps and transitions between rods.',
      skillFocus: '10-complement fluency, rod-to-rod jumps.',
    },

    // Level 4 – Multi-Digit Pro
    {
      index: 10,
      title: 'L4M1: Two-Digit Addition with Carry',
      summary: 'Add structured carry handling into 2-digit addition.',
      skillFocus: 'Carry logic, top-layer activation, stable vertical layout.',
    },
    {
      index: 11,
      title: 'L4M2: Two-Digit Subtraction with Borrow',
      summary: 'Mirror carry logic with borrow strategies for subtraction.',
      skillFocus: 'Borrow techniques, negative transitions, error control.',
    },
    {
      index: 12,
      title: 'L4M3: Mixed Two–Three Digit Operations',
      summary: 'Transition from simple multi-digit operations into mixed 2–3 digit problems.',
      skillFocus: 'Complex alignment, switching between 2 and 3 digits confidently.',
    },

    // Level 5 – Advanced Jumps & Patterns
    {
      index: 13,
      title: 'L5M1: Three-Digit Core Operations',
      summary: 'Stabilize 3-digit addition and subtraction as a default working range.',
      skillFocus: '3-digit fluency, visual span, rod coverage expansion.',
    },
    {
      index: 14,
      title: 'L5M2: Complex Jump Patterns',
      summary: 'Introduce layered jump patterns using the Beats hybrid frame.',
      skillFocus: 'Multi-step jump sequences, predictive hand movement.',
    },
    {
      index: 15,
      title: 'L5M3: Cross-Rod Transitions',
      summary: 'Train smooth transitions across multiple rods in both layers.',
      skillFocus: 'Cross-rod speed, bi-directional scanning, error recovery.',
    },

    // Level 6 – High-Speed Mixed Operations
    {
      index: 16,
      title: 'L6M1: High-Speed Timed Drills',
      summary: 'Push time constraints aggressively while maintaining accuracy.',
      skillFocus: 'Reaction time, high-speed processing, stable accuracy under pressure.',
    },
    {
      index: 17,
      title: 'L6M2: Mixed 3–4 Digit Operations',
      summary: 'Combine 3–4 digit addition and subtraction in timed sets.',
      skillFocus: 'Extended digit span, pressure handling, sustained focus.',
    },
    {
      index: 18,
      title: 'L6M3: Mental-Only Frame Transition',
      summary: 'Shift from physical frame to full mental visualization for trained patterns.',
      skillFocus: 'Mental abacus visualization, bead imaging, working memory.',
    },

    // Level 7 – Pre-Master Fusion
    {
      index: 19,
      title: 'L7M1: Long-Series Calculations',
      summary: 'Introduce long chains of numbers with minimal pauses.',
      skillFocus: 'Series stability, tracking cumulative totals mentally.',
    },
    {
      index: 20,
      title: 'L7M2: Error Detection & Correction',
      summary: 'Teach students to detect and correct mistakes without restarting.',
      skillFocus: 'Meta-awareness, self-correction strategies.',
    },
    {
      index: 21,
      title: 'L7M3: Competitive Drill Prep',
      summary: 'Simulate competitive conditions with strict time and scoring rules.',
      skillFocus: 'Performance stability, exam mindset, pacing strategies.',
    },

    // Level 8 – Master Level I
    {
      index: 22,
      title: 'L8M1: High-Digit Sequences (5–6 Digits)',
      summary: 'Extend operations to 5–6 digit ranges with full-frame coverage.',
      skillFocus: 'Large-number operations, deep visual field usage.',
    },
    {
      index: 23,
      title: 'L8M2: Dual-Layer Speed & Logic',
      summary: 'Explicitly train switching between logic-layer and speed-layer beads.',
      skillFocus: 'Layer switching, mode awareness, mental mode toggling.',
    },
    {
      index: 24,
      title: 'L8M3: Visualization Marathons',
      summary: 'Run extended mental-only sessions with minimal physical frame use.',
      skillFocus: 'Mental stamina, long-duration visualization, concentration.',
    },

    // Level 9 – Master Level II
    {
      index: 25,
      title: 'L9M1: Real-World Word Problems',
      summary: 'Map real-life scenarios into numeric structures suitable for abacus.',
      skillFocus: 'Word-to-number translation, application thinking.',
    },
    {
      index: 26,
      title: 'L9M2: Exam-Mode Speed & Stress Handling',
      summary: 'Simulate exam environments repeatedly to build emotional resilience.',
      skillFocus: 'Stress control, timeboxing, prioritization during exams.',
    },
    {
      index: 27,
      title: 'L9M3: AI-Driven Custom Challenge Sets',
      summary: 'Use AI-generated sets tuned to individual weaknesses.',
      skillFocus: 'Targeted remediation, adaptive challenge consumption.',
    },

    // Level 10 – Grand Master Level III
    {
      index: 28,
      title: 'L10M1: Grand Master Composite Drills',
      summary: 'Combine everything into mixed-mode composite drill sets.',
      skillFocus: 'Full-scope integration, maximal difficulty handling.',
    },
    {
      index: 29,
      title: 'L10M2: Endurance & Marathon Sets',
      summary: 'Very long-duration practice sessions mimicking real competitions.',
      skillFocus: 'Endurance, focus resilience, zero-drop performance.',
    },
    {
      index: 30,
      title: 'L10M3: Final Mastery Lab',
      summary: 'Final lab-style module with custom-designed problem sets and reflections.',
      skillFocus: 'Self-analysis, mastery validation, readiness for certification.',
    },
  ];

  const levelDefs: {
    moduleIndex: number;
    order: number;
    name: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    ageGroup: string;
    operations: string[];
    formulas: string[];
    maxDigits: number;
    maxTerms: number;
    examDurationMin: number;
    passingPercent: number;
    timeBonusEnabled: boolean;
  }[] = [
    // Level 1 – Foundations (Modules 1,2,3)
    {
      moduleIndex: 1,
      order: 1,
      name: 'Level 1 – Basics',
      difficulty: 'EASY',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: [],
      maxDigits: 1,
      maxTerms: 2,
      examDurationMin: 10,
      passingPercent: 70,
      timeBonusEnabled: false,
    },
    {
      moduleIndex: 2,
      order: 2,
      name: 'Level 1 – Units & Tens',
      difficulty: 'EASY',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: [],
      maxDigits: 1,
      maxTerms: 2,
      examDurationMin: 12,
      passingPercent: 72,
      timeBonusEnabled: false,
    },
    {
      moduleIndex: 3,
      order: 3,
      name: 'Level 1 – Single Digit Ops',
      difficulty: 'EASY',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: [],
      maxDigits: 1,
      maxTerms: 3,
      examDurationMin: 15,
      passingPercent: 75,
      timeBonusEnabled: false,
    },

    // Level 2 – Speed Operations (Modules 4,5,6)
    {
      moduleIndex: 4,
      order: 1,
      name: 'Level 2 – Speed Drills',
      difficulty: 'EASY',
      ageGroup: 'GENERAL',
      operations: ['ADDITION'],
      formulas: [],
      maxDigits: 1,
      maxTerms: 3,
      examDurationMin: 12,
      passingPercent: 75,
      timeBonusEnabled: true,
    },
    {
      moduleIndex: 5,
      order: 2,
      name: 'Level 2 – 2-Digit Add (No Carry)',
      difficulty: 'MEDIUM',
      ageGroup: 'GENERAL',
      operations: ['ADDITION'],
      formulas: [],
      maxDigits: 2,
      maxTerms: 2,
      examDurationMin: 15,
      passingPercent: 78,
      timeBonusEnabled: true,
    },
    {
      moduleIndex: 6,
      order: 3,
      name: 'Level 2 – 2-Digit Sub (No Borrow)',
      difficulty: 'MEDIUM',
      ageGroup: 'GENERAL',
      operations: ['SUBTRACTION'],
      formulas: [],
      maxDigits: 2,
      maxTerms: 2,
      examDurationMin: 15,
      passingPercent: 78,
      timeBonusEnabled: true,
    },

    // Level 3 – Pattern Mastery (Modules 7,8,9)
    {
      moduleIndex: 7,
      order: 1,
      name: 'Level 3 – Grouping Patterns',
      difficulty: 'MEDIUM',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: ['grouping'],
      maxDigits: 2,
      maxTerms: 3,
      examDurationMin: 18,
      passingPercent: 80,
      timeBonusEnabled: true,
    },
    {
      moduleIndex: 8,
      order: 2,
      name: 'Level 3 – Complement / 5 Patterns',
      difficulty: 'MEDIUM',
      ageGroup: 'GENERAL',
      operations: ['ADDITION'],
      formulas: ['5-combo', 'complement'],
      maxDigits: 2,
      maxTerms: 3,
      examDurationMin: 18,
      passingPercent: 80,
      timeBonusEnabled: true,
    },
    {
      moduleIndex: 9,
      order: 3,
      name: 'Level 3 – 10-Jump Patterns',
      difficulty: 'MEDIUM',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: ['10-complement'],
      maxDigits: 3,
      maxTerms: 3,
      examDurationMin: 20,
      passingPercent: 82,
      timeBonusEnabled: true,
    },

    // Level 4 – Multi-Digit Pro (Modules 10,11,12)
    {
      moduleIndex: 10,
      order: 1,
      name: 'Level 4 – Add with Carry',
      difficulty: 'MEDIUM',
      ageGroup: 'GENERAL',
      operations: ['ADDITION'],
      formulas: ['carry'],
      maxDigits: 2,
      maxTerms: 3,
      examDurationMin: 20,
      passingPercent: 82,
      timeBonusEnabled: true,
    },
    {
      moduleIndex: 11,
      order: 2,
      name: 'Level 4 – Sub with Borrow',
      difficulty: 'MEDIUM',
      ageGroup: 'GENERAL',
      operations: ['SUBTRACTION'],
      formulas: ['borrow'],
      maxDigits: 2,
      maxTerms: 3,
      examDurationMin: 20,
      passingPercent: 82,
      timeBonusEnabled: true,
    },
    {
      moduleIndex: 12,
      order: 3,
      name: 'Level 4 – Mixed 2–3 Digit Ops',
      difficulty: 'MEDIUM',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: ['carry', 'borrow'],
      maxDigits: 3,
      maxTerms: 3,
      examDurationMin: 22,
      passingPercent: 83,
      timeBonusEnabled: true,
    },

    // Level 5 – Advanced Jumps (Modules 13,14,15)
    {
      moduleIndex: 13,
      order: 1,
      name: 'Level 5 – 3-Digit Core Ops',
      difficulty: 'MEDIUM',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: [],
      maxDigits: 3,
      maxTerms: 3,
      examDurationMin: 22,
      passingPercent: 84,
      timeBonusEnabled: true,
    },
    {
      moduleIndex: 14,
      order: 2,
      name: 'Level 5 – Complex Jump Patterns',
      difficulty: 'HARD',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: ['jump'],
      maxDigits: 3,
      maxTerms: 4,
      examDurationMin: 24,
      passingPercent: 85,
      timeBonusEnabled: true,
    },
    {
      moduleIndex: 15,
      order: 3,
      name: 'Level 5 – Cross-Rod Transitions',
      difficulty: 'HARD',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: ['transition'],
      maxDigits: 3,
      maxTerms: 4,
      examDurationMin: 24,
      passingPercent: 85,
      timeBonusEnabled: true,
    },

    // Level 6 – High-Speed Mixed Ops (Modules 16,17,18)
    {
      moduleIndex: 16,
      order: 1,
      name: 'Level 6 – High-Speed Drills',
      difficulty: 'HARD',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: [],
      maxDigits: 3,
      maxTerms: 5,
      examDurationMin: 25,
      passingPercent: 86,
      timeBonusEnabled: true,
    },
    {
      moduleIndex: 17,
      order: 2,
      name: 'Level 6 – Mixed 3–4 Digit Ops',
      difficulty: 'HARD',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: [],
      maxDigits: 4,
      maxTerms: 5,
      examDurationMin: 25,
      passingPercent: 86,
      timeBonusEnabled: true,
    },
    {
      moduleIndex: 18,
      order: 3,
      name: 'Level 6 – Mental-Only Transition',
      difficulty: 'HARD',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: [],
      maxDigits: 4,
      maxTerms: 5,
      examDurationMin: 28,
      passingPercent: 87,
      timeBonusEnabled: true,
    },

    // Level 7 – Pre-Master Fusion (Modules 19,20,21)
    {
      moduleIndex: 19,
      order: 1,
      name: 'Level 7 – Long-Series Ops',
      difficulty: 'HARD',
      ageGroup: 'GENERAL',
      operations: ['ADDITION'],
      formulas: [],
      maxDigits: 4,
      maxTerms: 8,
      examDurationMin: 30,
      passingPercent: 88,
      timeBonusEnabled: true,
    },
    {
      moduleIndex: 20,
      order: 2,
      name: 'Level 7 – Error Detection',
      difficulty: 'HARD',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: [],
      maxDigits: 4,
      maxTerms: 8,
      examDurationMin: 30,
      passingPercent: 88,
      timeBonusEnabled: true,
    },
    {
      moduleIndex: 21,
      order: 3,
      name: 'Level 7 – Competitive Prep',
      difficulty: 'HARD',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: [],
      maxDigits: 4,
      maxTerms: 8,
      examDurationMin: 32,
      passingPercent: 90,
      timeBonusEnabled: true,
    },

    // Level 8 – Master Level I (Modules 22,23,24)
    {
      moduleIndex: 22,
      order: 1,
      name: 'Level 8 – High-Digit Sequences',
      difficulty: 'HARD',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: [],
      maxDigits: 6,
      maxTerms: 10,
      examDurationMin: 32,
      passingPercent: 92,
      timeBonusEnabled: true,
    },
    {
      moduleIndex: 23,
      order: 2,
      name: 'Level 8 – Dual-Layer Training',
      difficulty: 'HARD',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: [],
      maxDigits: 6,
      maxTerms: 10,
      examDurationMin: 35,
      passingPercent: 92,
      timeBonusEnabled: true,
    },
    {
      moduleIndex: 24,
      order: 3,
      name: 'Level 8 – Visualization Marathon',
      difficulty: 'HARD',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: [],
      maxDigits: 6,
      maxTerms: 10,
      examDurationMin: 35,
      passingPercent: 93,
      timeBonusEnabled: true,
    },

    // Level 9 – Master Level II (Modules 25,26,27)
    {
      moduleIndex: 25,
      order: 1,
      name: 'Level 9 – Word Problem Mapping',
      difficulty: 'HARD',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: [],
      maxDigits: 6,
      maxTerms: 12,
      examDurationMin: 35,
      passingPercent: 94,
      timeBonusEnabled: true,
    },
    {
      moduleIndex: 26,
      order: 2,
      name: 'Level 9 – Exam-Mode Stress Handling',
      difficulty: 'HARD',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: [],
      maxDigits: 6,
      maxTerms: 12,
      examDurationMin: 38,
      passingPercent: 94,
      timeBonusEnabled: true,
    },
    {
      moduleIndex: 27,
      order: 3,
      name: 'Level 9 – AI Custom Challenges',
      difficulty: 'HARD',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: [],
      maxDigits: 6,
      maxTerms: 12,
      examDurationMin: 38,
      passingPercent: 95,
      timeBonusEnabled: true,
    },

    // Level 10 – Grand Master Level III (Modules 28,29,30)
    {
      moduleIndex: 28,
      order: 1,
      name: 'Level 10 – Composite Drills',
      difficulty: 'HARD',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: [],
      maxDigits: 7,
      maxTerms: 15,
      examDurationMin: 40,
      passingPercent: 95,
      timeBonusEnabled: true,
    },
    {
      moduleIndex: 29,
      order: 2,
      name: 'Level 10 – Endurance Sets',
      difficulty: 'HARD',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: [],
      maxDigits: 7,
      maxTerms: 15,
      examDurationMin: 42,
      passingPercent: 96,
      timeBonusEnabled: true,
    },
    {
      moduleIndex: 30,
      order: 3,
      name: 'Level 10 – Mastery Lab',
      difficulty: 'HARD',
      ageGroup: 'GENERAL',
      operations: ['ADDITION', 'SUBTRACTION'],
      formulas: [],
      maxDigits: 7,
      maxTerms: 15,
      examDurationMin: 45,
      passingPercent: 97,
      timeBonusEnabled: true,
    },
  ];

  const worksheetDefs: {
    moduleIndex: number;
    levelOrder: number;
    title: string;
    kind: 'PRACTICE' | 'SPEED' | 'EXAM' | 'HOMEWORK';
    difficultyBand: 'EASY' | 'MEDIUM' | 'HARD';
    questionCount: number;
    notes?: string;
  }[] = [
    // Level 1 – Foundations (Modules 1–3)
    { moduleIndex: 1, levelOrder: 1, title: 'L1M1 Practice – Frame Basics', kind: 'PRACTICE', difficultyBand: 'EASY', questionCount: 20, notes: 'Basic bead placement and recognition.' },
    { moduleIndex: 1, levelOrder: 1, title: 'L1M1 Speed – Visual Recognition', kind: 'SPEED', difficultyBand: 'EASY', questionCount: 20, notes: 'Quick recognition of patterns and rods.' },
    { moduleIndex: 1, levelOrder: 1, title: 'L1M1 Exam – Foundations Check', kind: 'EXAM', difficultyBand: 'EASY', questionCount: 25, notes: 'Short exam on frame orientation basics.' },

    { moduleIndex: 2, levelOrder: 2, title: 'L1M2 Practice – Units & Tens', kind: 'PRACTICE', difficultyBand: 'EASY', questionCount: 20, notes: 'Formation of units and tens on Beats frame.' },
    { moduleIndex: 2, levelOrder: 2, title: 'L1M2 Homework – Place Value', kind: 'HOMEWORK', difficultyBand: 'EASY', questionCount: 20, notes: 'Home practice for units and tens mapping.' },
    { moduleIndex: 2, levelOrder: 2, title: 'L1M2 Exam – Units/Tens Basics', kind: 'EXAM', difficultyBand: 'EASY', questionCount: 25, notes: 'Check for place-value understanding.' },

    { moduleIndex: 3, levelOrder: 3, title: 'L1M3 Practice – Single Digit Ops', kind: 'PRACTICE', difficultyBand: 'EASY', questionCount: 25, notes: 'Single-digit add/sub sums with full frame support.' },
    { moduleIndex: 3, levelOrder: 3, title: 'L1M3 Speed – Single Digit Sprint', kind: 'SPEED', difficultyBand: 'EASY', questionCount: 25, notes: 'Light speed drill with single digits.' },
    { moduleIndex: 3, levelOrder: 3, title: 'L1M3 Exam – Single Digit Check', kind: 'EXAM', difficultyBand: 'EASY', questionCount: 30, notes: 'End of Level 1 exam focus.' },

    // Level 2 – Speed Operations (Modules 4–6)
    { moduleIndex: 4, levelOrder: 1, title: 'L2M1 Practice – Speed Drills', kind: 'PRACTICE', difficultyBand: 'EASY', questionCount: 25, notes: 'Timed basic operations for rhythm.' },
    { moduleIndex: 4, levelOrder: 1, title: 'L2M1 Speed – Single Digit Burst', kind: 'SPEED', difficultyBand: 'EASY', questionCount: 30, notes: 'Short-timer repeated speed sets.' },
    { moduleIndex: 4, levelOrder: 1, title: 'L2M1 Exam – Speed Fundamentals', kind: 'EXAM', difficultyBand: 'MEDIUM', questionCount: 30, notes: 'Checks handling of time pressure.' },

    { moduleIndex: 5, levelOrder: 2, title: 'L2M2 Practice – 2D Add (No Carry)', kind: 'PRACTICE', difficultyBand: 'MEDIUM', questionCount: 25, notes: '2-digit addition without carry.' },
    { moduleIndex: 5, levelOrder: 2, title: 'L2M2 Homework – Layout Practice', kind: 'HOMEWORK', difficultyBand: 'MEDIUM', questionCount: 25, notes: 'Homework for column alignment.' },
    { moduleIndex: 5, levelOrder: 2, title: 'L2M2 Exam – 2D Add Basics', kind: 'EXAM', difficultyBand: 'MEDIUM', questionCount: 30, notes: 'Checks 2-digit addition structure.' },

    { moduleIndex: 6, levelOrder: 3, title: 'L2M3 Practice – 2D Sub (No Borrow)', kind: 'PRACTICE', difficultyBand: 'MEDIUM', questionCount: 25, notes: '2-digit subtraction without borrow.' },
    { moduleIndex: 6, levelOrder: 3, title: 'L2M3 Speed – 2D Quick Subtraction', kind: 'SPEED', difficultyBand: 'MEDIUM', questionCount: 30, notes: 'Timed 2-digit subtraction sets.' },
    { moduleIndex: 6, levelOrder: 3, title: 'L2M3 Exam – 2D Sub Basics', kind: 'EXAM', difficultyBand: 'MEDIUM', questionCount: 30, notes: 'End of Level 2 check.' },

    // Level 3 – Pattern Mastery (Modules 7–9)
    { moduleIndex: 7, levelOrder: 1, title: 'L3M1 Practice – Grouping Patterns', kind: 'PRACTICE', difficultyBand: 'MEDIUM', questionCount: 30, notes: 'Grouping similar sums for chunking.' },
    { moduleIndex: 7, levelOrder: 1, title: 'L3M1 Homework – Pattern Blocks', kind: 'HOMEWORK', difficultyBand: 'MEDIUM', questionCount: 25, notes: 'Home tasks focusing on repeated blocks.' },
    { moduleIndex: 7, levelOrder: 1, title: 'L3M1 Exam – Grouping Skills', kind: 'EXAM', difficultyBand: 'MEDIUM', questionCount: 30, notes: 'Check grouping comprehension.' },

    { moduleIndex: 8, levelOrder: 2, title: 'L3M2 Practice – Complements & 5-Patterns', kind: 'PRACTICE', difficultyBand: 'MEDIUM', questionCount: 30, notes: 'Complement and 5-combo patterns.' },
    { moduleIndex: 8, levelOrder: 2, title: 'L3M2 Speed – 5-Based Jumps', kind: 'SPEED', difficultyBand: 'MEDIUM', questionCount: 30, notes: 'Faster drills using 5-based jumps.' },
    { moduleIndex: 8, levelOrder: 2, title: 'L3M2 Exam – Complement Logic', kind: 'EXAM', difficultyBand: 'MEDIUM', questionCount: 35, notes: 'Evaluation of 5/complement usage.' },

    { moduleIndex: 9, levelOrder: 3, title: 'L3M3 Practice – 10-Jump Patterns', kind: 'PRACTICE', difficultyBand: 'MEDIUM', questionCount: 30, notes: '10-based jump exercises.' },
    { moduleIndex: 9, levelOrder: 3, title: 'L3M3 Speed – Jump Combo Sets', kind: 'SPEED', difficultyBand: 'HARD', questionCount: 35, notes: 'Aggressive jump pattern chains.' },
    { moduleIndex: 9, levelOrder: 3, title: 'L3M3 Exam – Pattern Mastery', kind: 'EXAM', difficultyBand: 'HARD', questionCount: 35, notes: 'End of Level 3 pattern mastery exam.' },

    // Level 4 – Multi-Digit Pro (Modules 10–12)
    { moduleIndex: 10, levelOrder: 1, title: 'L4M1 Practice – Add with Carry', kind: 'PRACTICE', difficultyBand: 'MEDIUM', questionCount: 30, notes: '2-digit addition with carry.' },
    { moduleIndex: 10, levelOrder: 1, title: 'L4M1 Homework – Carry Focus', kind: 'HOMEWORK', difficultyBand: 'MEDIUM', questionCount: 25, notes: 'Carry-heavy homework sets.' },
    { moduleIndex: 10, levelOrder: 1, title: 'L4M1 Exam – Carry Mastery', kind: 'EXAM', difficultyBand: 'HARD', questionCount: 35, notes: 'Carry operations under time pressure.' },

    { moduleIndex: 11, levelOrder: 2, title: 'L4M2 Practice – Sub with Borrow', kind: 'PRACTICE', difficultyBand: 'MEDIUM', questionCount: 30, notes: '2-digit subtraction with borrow.' },
    { moduleIndex: 11, levelOrder: 2, title: 'L4M2 Speed – Borrow Drill', kind: 'SPEED', difficultyBand: 'HARD', questionCount: 35, notes: 'Borrow-heavy fast sets.' },
    { moduleIndex: 11, levelOrder: 2, title: 'L4M2 Exam – Borrow Mastery', kind: 'EXAM', difficultyBand: 'HARD', questionCount: 35, notes: 'Borrow-focused exam paper.' },

    { moduleIndex: 12, levelOrder: 3, title: 'L4M3 Practice – Mixed 2–3 Digit', kind: 'PRACTICE', difficultyBand: 'MEDIUM', questionCount: 35, notes: 'Mixed 2–3 digit sets.' },
    { moduleIndex: 12, levelOrder: 3, title: 'L4M3 Speed – Mixed Ops', kind: 'SPEED', difficultyBand: 'HARD', questionCount: 35, notes: 'Fast mixed operations.' },
    { moduleIndex: 12, levelOrder: 3, title: 'L4M3 Exam – Multi-Digit Pro', kind: 'EXAM', difficultyBand: 'HARD', questionCount: 40, notes: 'End of Level 4 evaluation.' },

    // Level 5 – Advanced Jumps (Modules 13–15)
    { moduleIndex: 13, levelOrder: 1, title: 'L5M1 Practice – 3-Digit Core', kind: 'PRACTICE', difficultyBand: 'MEDIUM', questionCount: 35, notes: 'Core 3-digit operations.' },
    { moduleIndex: 13, levelOrder: 1, title: 'L5M1 Homework – Extended 3D', kind: 'HOMEWORK', difficultyBand: 'MEDIUM', questionCount: 30, notes: 'Homework on extended 3-digit sums.' },
    { moduleIndex: 13, levelOrder: 1, title: 'L5M1 Exam – 3D Core Skills', kind: 'EXAM', difficultyBand: 'HARD', questionCount: 40, notes: '3-digit operation exam.' },

    { moduleIndex: 14, levelOrder: 2, title: 'L5M2 Practice – Complex Jumps', kind: 'PRACTICE', difficultyBand: 'HARD', questionCount: 35, notes: 'Complex jump exercises.' },
    { moduleIndex: 14, levelOrder: 2, title: 'L5M2 Speed – Jump Combos', kind: 'SPEED', difficultyBand: 'HARD', questionCount: 40, notes: 'High-speed jump sets.' },
    { moduleIndex: 14, levelOrder: 2, title: 'L5M2 Exam – Jump Mastery', kind: 'EXAM', difficultyBand: 'HARD', questionCount: 40, notes: 'Tests advanced jumps.' },

    { moduleIndex: 15, levelOrder: 3, title: 'L5M3 Practice – Cross-Rod', kind: 'PRACTICE', difficultyBand: 'HARD', questionCount: 35, notes: 'Cross-rod transition drills.' },
    { moduleIndex: 15, levelOrder: 3, title: 'L5M3 Speed – Cross-Rod Flow', kind: 'SPEED', difficultyBand: 'HARD', questionCount: 40, notes: 'Speed focus on transitions.' },
    { moduleIndex: 15, levelOrder: 3, title: 'L5M3 Exam – Advanced Patterns', kind: 'EXAM', difficultyBand: 'HARD', questionCount: 40, notes: 'End of Level 5 exam.' },

    // Level 6 – High-Speed Mixed Ops (Modules 16–18)
    { moduleIndex: 16, levelOrder: 1, title: 'L6M1 Practice – High-Speed Drills', kind: 'PRACTICE', difficultyBand: 'HARD', questionCount: 40, notes: 'High-speed mixed drills.' },
    { moduleIndex: 16, levelOrder: 1, title: 'L6M1 Speed – Timed Chains', kind: 'SPEED', difficultyBand: 'HARD', questionCount: 45, notes: 'Chain-style fast operations.' },
    { moduleIndex: 16, levelOrder: 1, title: 'L6M1 Exam – Speed Check', kind: 'EXAM', difficultyBand: 'HARD', questionCount: 45, notes: 'Speed vs accuracy evaluation.' },

    { moduleIndex: 17, levelOrder: 2, title: 'L6M2 Practice – 3–4 Digit Mix', kind: 'PRACTICE', difficultyBand: 'HARD', questionCount: 40, notes: 'Mixed 3–4 digit operations.' },
    { moduleIndex: 17, levelOrder: 2, title: 'L6M2 Speed – Extended Mix', kind: 'SPEED', difficultyBand: 'HARD', questionCount: 45, notes: 'Fast extended range tasks.' },
    { moduleIndex: 17, levelOrder: 2, title: 'L6M2 Exam – Mixed Ops Mastery', kind: 'EXAM', difficultyBand: 'HARD', questionCount: 45, notes: 'Checks 3–4 digit mastery.' },

    { moduleIndex: 18, levelOrder: 3, title: 'L6M3 Practice – Mental Transition', kind: 'PRACTICE', difficultyBand: 'HARD', questionCount: 40, notes: 'Practice mental-only sets.' },
    { moduleIndex: 18, levelOrder: 3, title: 'L6M3 Speed – Mental Burst', kind: 'SPEED', difficultyBand: 'HARD', questionCount: 45, notes: 'Timed mental drills.' },
    { moduleIndex: 18, levelOrder: 3, title: 'L6M3 Exam – Mental Ops', kind: 'EXAM', difficultyBand: 'HARD', questionCount: 45, notes: 'Exam with reduced physical frame usage.' },

    // Level 7 – Pre-Master Fusion (Modules 19–21)
    { moduleIndex: 19, levelOrder: 1, title: 'L7M1 Practice – Long Series', kind: 'PRACTICE', difficultyBand: 'HARD', questionCount: 45, notes: 'Long series of terms in a row.' },
    { moduleIndex: 19, levelOrder: 1, title: 'L7M1 Homework – Long Chain', kind: 'HOMEWORK', difficultyBand: 'HARD', questionCount: 40, notes: 'Homework on extended chains.' },
    { moduleIndex: 19, levelOrder: 1, title: 'L7M1 Exam – Series Handling', kind: 'EXAM', difficultyBand: 'HARD', questionCount: 50, notes: 'Exam on long series skills.' },

    { moduleIndex: 20, levelOrder: 2, title: 'L7M2 Practice – Error Detection', kind: 'PRACTICE', difficultyBand: 'HARD', questionCount: 40, notes: 'Patterns with built-in traps.' },
    { moduleIndex: 20, levelOrder: 2, title: 'L7M2 Speed – Correction Drill', kind: 'SPEED', difficultyBand: 'HARD', questionCount: 45, notes: 'Timed error-detection tasks.' },
    { moduleIndex: 20, levelOrder: 2, title: 'L7M2 Exam – Error Awareness', kind: 'EXAM', difficultyBand: 'HARD', questionCount: 50, notes: 'Exam focused on accuracy recovery.' },

    { moduleIndex: 21, levelOrder: 3, title: 'L7M3 Practice – Competitive Sets', kind: 'PRACTICE', difficultyBand: 'HARD', questionCount: 45, notes: 'Competition-style sets.' },
    { moduleIndex: 21, levelOrder: 3, title: 'L7M3 Speed – Competitive Pace', kind: 'SPEED', difficultyBand: 'HARD', questionCount: 50, notes: 'High-intensity time windows.' },
    { moduleIndex: 21, levelOrder: 3, title: 'L7M3 Exam – Pre-Master Check', kind: 'EXAM', difficultyBand: 'HARD', questionCount: 50, notes: 'End of Level 7 pre-master exam.' },

    // Level 8 – Master Level I (Modules 22–24)
    { moduleIndex: 22, levelOrder: 1, title: 'L8M1 Practice – High-Digit Sequences', kind: 'PRACTICE', difficultyBand: 'HARD', questionCount: 50, notes: '5–6 digit operations.' },
    { moduleIndex: 22, levelOrder: 1, title: 'L8M1 Speed – High-Digit Sprint', kind: 'SPEED', difficultyBand: 'HARD', questionCount: 55, notes: 'Fast 5–6 digit sets.' },
    { moduleIndex: 22, levelOrder: 1, title: 'L8M1 Exam – High-Digit Exam', kind: 'EXAM', difficultyBand: 'HARD', questionCount: 55, notes: 'Exam on large-number stability.' },

    { moduleIndex: 23, levelOrder: 2, title: 'L8M2 Practice – Dual-Layer Focus', kind: 'PRACTICE', difficultyBand: 'HARD', questionCount: 50, notes: 'Practice switching between bead layers.' },
    { moduleIndex: 23, levelOrder: 2, title: 'L8M2 Speed – Dual-Layer Flow', kind: 'SPEED', difficultyBand: 'HARD', questionCount: 55, notes: 'Timed dual-layer transitions.' },
    { moduleIndex: 23, levelOrder: 2, title: 'L8M2 Exam – Dual-Layer Mastery', kind: 'EXAM', difficultyBand: 'HARD', questionCount: 55, notes: 'Exam on hybrid-frame usage.' },

    { moduleIndex: 24, levelOrder: 3, title: 'L8M3 Practice – Visualization Marathon', kind: 'PRACTICE', difficultyBand: 'HARD', questionCount: 50, notes: 'Long-duration mental sequences.' },
    { moduleIndex: 24, levelOrder: 3, title: 'L8M3 Speed – Mental Marathon', kind: 'SPEED', difficultyBand: 'HARD', questionCount: 55, notes: 'Timed long-duration sets.' },
    { moduleIndex: 24, levelOrder: 3, title: 'L8M3 Exam – Master I Checkpoint', kind: 'EXAM', difficultyBand: 'HARD', questionCount: 60, notes: 'End of Master Level I exam.' },

    // Level 9 – Master Level II (Modules 25–27)
    { moduleIndex: 25, levelOrder: 1, title: 'L9M1 Practice – Word Problems', kind: 'PRACTICE', difficultyBand: 'HARD', questionCount: 45, notes: 'Real-world to numeric translation tasks.' },
    { moduleIndex: 25, levelOrder: 1, title: 'L9M1 Homework – Context Sets', kind: 'HOMEWORK', difficultyBand: 'HARD', questionCount: 40, notes: 'Home tasks for modeling real-life cases.' },
    { moduleIndex: 25, levelOrder: 1, title: 'L9M1 Exam – Application Skills', kind: 'EXAM', difficultyBand: 'HARD', questionCount: 50, notes: 'Application-focused evaluation.' },

    { moduleIndex: 26, levelOrder: 2, title: 'L9M2 Practice – Exam-Mode Drills', kind: 'PRACTICE', difficultyBand: 'HARD', questionCount: 50, notes: 'Exam-style sets with full constraints.' },
    { moduleIndex: 26, levelOrder: 2, title: 'L9M2 Speed – Stress Handling', kind: 'SPEED', difficultyBand: 'HARD', questionCount: 55, notes: 'Timed stress simulations.' },
    { moduleIndex: 26, levelOrder: 2, title: 'L9M2 Exam – Exam-Mode Mastery', kind: 'EXAM', difficultyBand: 'HARD', questionCount: 55, notes: 'Exam-mode resilience test.' },

    { moduleIndex: 27, levelOrder: 3, title: 'L9M3 Practice – AI Challenge Sets', kind: 'PRACTICE', difficultyBand: 'HARD', questionCount: 50, notes: 'Static version of AI-challenge style sets.' },
    { moduleIndex: 27, levelOrder: 3, title: 'L9M3 Speed – Adaptive Sim', kind: 'SPEED', difficultyBand: 'HARD', questionCount: 55, notes: 'Speed drills mimicking AI adaptation.' },
    { moduleIndex: 27, levelOrder: 3, title: 'L9M3 Exam – Master II Checkpoint', kind: 'EXAM', difficultyBand: 'HARD', questionCount: 60, notes: 'End of Master Level II exam.' },

    // Level 10 – Grand Master Level III (Modules 28–30)
    { moduleIndex: 28, levelOrder: 1, title: 'L10M1 Practice – Composite Drills', kind: 'PRACTICE', difficultyBand: 'HARD', questionCount: 55, notes: 'Mixed all-skill drills.' },
    { moduleIndex: 28, levelOrder: 1, title: 'L10M1 Speed – Composite Burst', kind: 'SPEED', difficultyBand: 'HARD', questionCount: 60, notes: 'High-speed mixed sets.' },
    { moduleIndex: 28, levelOrder: 1, title: 'L10M1 Exam – Composite Exam', kind: 'EXAM', difficultyBand: 'HARD', questionCount: 65, notes: 'Composite skill evaluation.' },

    { moduleIndex: 29, levelOrder: 2, title: 'L10M2 Practice – Endurance Sets', kind: 'PRACTICE', difficultyBand: 'HARD', questionCount: 55, notes: 'Very long series for endurance.' },
    { moduleIndex: 29, levelOrder: 2, title: 'L10M2 Speed – Endurance Pace', kind: 'SPEED', difficultyBand: 'HARD', questionCount: 60, notes: 'Timed endurance blocks.' },
    { moduleIndex: 29, levelOrder: 2, title: 'L10M2 Exam – Endurance Mastery', kind: 'EXAM', difficultyBand: 'HARD', questionCount: 65, notes: 'Endurance-heavy exam.' },

    { moduleIndex: 30, levelOrder: 3, title: 'L10M3 Practice – Mastery Lab', kind: 'PRACTICE', difficultyBand: 'HARD', questionCount: 55, notes: 'Semi-open lab-style practice sets.' },
    { moduleIndex: 30, levelOrder: 3, title: 'L10M3 Speed – Final Sprint', kind: 'SPEED', difficultyBand: 'HARD', questionCount: 60, notes: 'Final-stage speed drills.' },
    { moduleIndex: 30, levelOrder: 3, title: 'L10M3 Exam – Grand Master Exam', kind: 'EXAM', difficultyBand: 'HARD', questionCount: 70, notes: 'Final certification exam for Beats Abacus 2.0.' },
  ];

  const course = await prisma.abacusCourse.upsert({
    where: { code: 'ABACUS_BEATS_20' },
    update: {},
    create: {
      code: 'ABACUS_BEATS_20',
      name: 'Beats Abacus 2.0',
      variant: 'BEATS20',
      description: 'AI-enhanced Abacus program with 10 progressive levels.',
    },
  });

  console.log('Course created:', course.code);

  const moduleByIndex = new Map<number, number>();

  for (const m of moduleDefs) {
    const module = await prisma.abacusModule.upsert({
      where: {
        courseId_index: {
          courseId: course.id,
          index: m.index,
        },
      },
      update: {
        title: m.title,
        summary: m.summary,
        skillFocus: m.skillFocus,
      },
      create: {
        courseId: course.id,
        index: m.index,
        title: m.title,
        summary: m.summary,
        skillFocus: m.skillFocus,
      },
    });

    moduleByIndex.set(m.index, module.id);
  }

  console.log(`Modules inserted: ${moduleByIndex.size}`);

  const levelByModuleOrder = new Map<string, number>();
  const levelMetaByModuleOrder = new Map<
    string,
    { maxDigits: number; maxTerms: number; operations: string[] }
  >();

  for (const lv of levelDefs) {
    const moduleId = moduleByIndex.get(lv.moduleIndex);

    if (!moduleId) {
      console.warn(`Missing module for level moduleIndex=${lv.moduleIndex}`);
      continue;
    }

    const level = await prisma.abacusLevel.upsert({
      where: { moduleId_order_unique: { moduleId, order: lv.order } },
      update: {
        name: lv.name,
        difficulty: lv.difficulty,
        ageGroup: lv.ageGroup,
        operations: lv.operations,
        formulas: lv.formulas,
        visualization: null,
        maxDigits: lv.maxDigits,
        maxTerms: lv.maxTerms,
        examDurationMin: lv.examDurationMin,
        passingPercent: lv.passingPercent,
        timeBonusEnabled: lv.timeBonusEnabled,
      },
      create: {
        moduleId,
        order: lv.order,
        name: lv.name,
        difficulty: lv.difficulty,
        ageGroup: lv.ageGroup,
        operations: lv.operations,
        formulas: lv.formulas,
        visualization: null,
        maxDigits: lv.maxDigits,
        maxTerms: lv.maxTerms,
        examDurationMin: lv.examDurationMin,
        passingPercent: lv.passingPercent,
        timeBonusEnabled: lv.timeBonusEnabled,
      },
    });

    levelByModuleOrder.set(`${moduleId}:${lv.order}`, level.id);
    levelMetaByModuleOrder.set(`${moduleId}:${lv.order}`, {
      maxDigits: lv.maxDigits,
      maxTerms: lv.maxTerms,
      operations: lv.operations,
    });
  }

  console.log(`Levels inserted: ${levelByModuleOrder.size}`);

  let worksheetCount = 0;

  for (const ws of worksheetDefs) {
    const moduleId = moduleByIndex.get(ws.moduleIndex);

    if (!moduleId) {
      console.warn(`Missing module for worksheet moduleIndex=${ws.moduleIndex}`);
      continue;
    }

    const levelId = levelByModuleOrder.get(`${moduleId}:${ws.levelOrder}`);

    if (!levelId) {
      console.warn(`Missing level for worksheet moduleIndex=${ws.moduleIndex} levelOrder=${ws.levelOrder}`);
      continue;
    }

    const levelMetaKey = `${moduleId}:${ws.levelOrder}`;
    const levelMeta = levelMetaByModuleOrder.get(levelMetaKey);
    const ops =
      levelMeta?.operations && levelMeta.operations.length > 0
        ? levelMeta.operations.map((op) => (op === 'ADDITION' ? 'ADD' : op === 'SUBTRACTION' ? 'SUB' : 'ADD'))
        : ['ADD', 'SUB'];
    const generationConfig = {
      questionCount: ws.questionCount,
      maxDigits: levelMeta?.maxDigits ?? 2,
      maxTerms: levelMeta?.maxTerms ?? 2,
      operations: ops,
    };

    const existing = await prisma.abacusWorksheet.findFirst({
      where: { levelId, title: ws.title },
    });

    if (existing) {
      await prisma.abacusWorksheet.update({
        where: { id: existing.id },
        data: {
          kind: ws.kind,
          difficultyBand: ws.difficultyBand,
          questionCount: ws.questionCount,
          notes: ws.notes ?? null,
          generationMode: 'TEMPLATE',
          generationConfig,
        },
      });
    } else {
      await prisma.abacusWorksheet.create({
        data: {
          levelId,
          title: ws.title,
          kind: ws.kind,
          difficultyBand: ws.difficultyBand,
          questionCount: ws.questionCount,
          notes: ws.notes ?? null,
          generationMode: 'TEMPLATE',
          generationConfig,
        },
      });
    }

    worksheetCount += 1;
  }

  console.log(`Worksheets inserted: ${worksheetCount}`);
  console.log('Seeding complete for Beats Abacus 2.0');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
