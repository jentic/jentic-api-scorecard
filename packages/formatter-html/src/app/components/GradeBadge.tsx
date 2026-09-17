const getGradeStyle = (grade: string): string => {
  const letter = grade.charAt(0);
  if (letter === 'A') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  if (letter === 'B') return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300';
  if (letter === 'C') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  if (letter === 'D')
    return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'; // F
};

interface GradeBadgeProps {
  grade: string;
}

export default function GradeBadge({ grade }: GradeBadgeProps) {
  return (
    <span className={`px-2 py-0.5 rounded text-sm font-medium ${getGradeStyle(grade)}`}>
      Grade: {grade}
    </span>
  );
}
