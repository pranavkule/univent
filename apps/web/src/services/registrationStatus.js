export async function loadStudentRegistrationStatus(listRegistrations, email, eventId) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) {
    return {
      status: 'unavailable',
      registeredEventIds: new Set(),
      registration: null,
      message: 'Could not determine registration status for this account.',
    }
  }

  try {
    const registrations = await listRegistrations(eventId)
    const mine = registrations.filter(
      (row) => String(row.email || '').toLowerCase() === normalizedEmail,
    )
    return {
      status: 'loaded',
      registeredEventIds: new Set(mine.map((row) => row.eventId)),
      registration: eventId ? mine.find((row) => row.eventId === eventId) || null : null,
      message: '',
    }
  } catch (error) {
    return {
      status: 'unavailable',
      registeredEventIds: new Set(),
      registration: null,
      message: error?.message || 'Could not check your registration status.',
    }
  }
}

export function registrationStatusView(status, registration = null) {
  const isKnown = status === 'loaded'
  return {
    isChecking: status === 'loading',
    isUnavailable: status === 'unavailable',
    isKnown,
    isRegistered: isKnown && Boolean(registration),
    canOfferRegistration: isKnown && !registration,
  }
}
