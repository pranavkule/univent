// Response shapes. These are the only event/registration fields that reach
// the client, so internal bookkeeping (for example the Cognito user id) is
// never exposed.
function publicEvent(event) {
  return {
    eventId: event.eventId,
    title: event.title,
    date: event.date,
    venue: event.venue,
    description: event.description,
    capacity: event.capacity,
    category: event.category,
    organizer: event.organizer,
    startTime: event.startTime,
    endTime: event.endTime,
    regDeadline: event.regDeadline,
    createdAt: event.createdAt,
  }
}

function publicRegistration(registration) {
  return {
    registrationId: registration.registrationId,
    eventId: registration.eventId,
    name: registration.name,
    email: registration.email,
    createdAt: registration.createdAt,
    status: registration.status,
  }
}

module.exports = { publicEvent, publicRegistration }
