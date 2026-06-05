const getGradeStyle = (grade: string): string => {
  const letter = grade.charAt(0);
  if (letter === 'A') return 'bg-green-100 text-green-800';
  if (letter === 'B') return 'bg-yellow-100 text-yellow-800';
  if (letter === 'C') return 'bg-yellow-100 text-yellow-800';
  if (letter === 'D') return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800'; // F
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
