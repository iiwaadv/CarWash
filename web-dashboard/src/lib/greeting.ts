export function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "صباح الخير ☀️";
  if (hour >= 12 && hour < 17) return "نهارك سعيد 🌤️";
  if (hour >= 17 && hour < 20) return "مساء الخير 🌇";
  return "مساء الخير 🌙";
}
