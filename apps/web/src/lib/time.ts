/**
 * Time-based greeting helper using local browser time.
 * - 5:00 AM to 11:59 AM -> "Good morning"
 * - 12:00 PM to 4:59 PM -> "Good afternoon"
 * - 5:00 PM to 8:59 PM -> "Good evening"
 * - 9:00 PM to 4:59 AM -> "Good night"
 */
export function getTimeGreeting(date: Date = new Date()): string {
  const hours = date.getHours();
  if (hours >= 5 && hours < 12) {
    return 'Good morning';
  } else if (hours >= 12 && hours < 17) {
    return 'Good afternoon';
  } else if (hours >= 17 && hours < 21) {
    return 'Good evening';
  } else {
    return 'Good night';
  }
}
