export function getRemainingSeats(event) {
  if (
    !Number.isInteger(event?.capacity)
    || event.capacity < 1
    || !Number.isInteger(event?.registeredCount)
    || event.registeredCount < 0
  ) {
    return null
  }
  return Math.max(0, event.capacity - event.registeredCount)
}
