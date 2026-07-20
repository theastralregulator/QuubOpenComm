/**
 * Time-based greeting helper using local browser time (Title Cased).
 * - 5:00 AM to 11:59 AM -> "Good Morning"
 * - 12:00 PM to 4:59 PM -> "Good Afternoon"
 * - 5:00 PM to 8:59 PM -> "Good Evening"
 * - 9:00 PM to 4:59 AM -> "Good Night"
 */
export function getTimeGreeting(date: Date = new Date()): string {
  const hours = date.getHours();
  if (hours >= 5 && hours < 12) {
    return 'Good Morning';
  } else if (hours >= 12 && hours < 17) {
    return 'Good Afternoon';
  } else if (hours >= 17 && hours < 21) {
    return 'Good Evening';
  } else {
    return 'Good Night';
  }
}
