// Local mock events. Shape matches docs/api.md so the UI never changes
// when this is replaced by real API calls in Phase 6.
// `category` is a frontend-only mock filter facet for Phase 2.
export const mockEvents = [
  {
    eventId: 'e1',
    title: 'Hack Night',
    date: '2026-11-02',
    venue: 'Seminar Hall A',
    description: 'Overnight hackathon. Form a team, build something, demo at dawn.',
    capacity: 100,
    category: 'Technical',
  },
  {
    eventId: 'e2',
    title: 'Robotics Workshop',
    date: '2026-11-08',
    venue: 'Mech Lab 2',
    description: 'Hands-on intro to Arduino and line-following robots. No experience needed.',
    capacity: 40,
    category: 'Technical',
  },
  {
    eventId: 'e3',
    title: 'Cultural Fest Auditions',
    date: '2026-11-12',
    venue: 'Open Air Theatre',
    description: 'Auditions for dance, music, and drama slots at the annual cultural fest.',
    capacity: 200,
    category: 'Cultural',
  },
  {
    eventId: 'e4',
    title: 'Cloud Computing Talk',
    date: '2026-11-15',
    venue: 'CSE Seminar Room',
    description: 'Guest lecture on serverless architectures with a live AWS demo.',
    capacity: 80,
    category: 'Technical',
  },
  {
    eventId: 'e5',
    title: 'Inter-College Football',
    date: '2026-11-20',
    venue: 'Main Ground',
    description: 'Trials for the college football squad ahead of the inter-college league.',
    capacity: 60,
    category: 'Sports',
  },
  {
    eventId: 'e6',
    title: 'Photography Walk',
    date: '2026-11-24',
    venue: 'Campus Gate',
    description: 'Morning photo walk around campus. Any camera, including phones.',
    capacity: 30,
    category: 'Cultural',
  },
  {
    eventId: 'e7',
    title: 'Entrepreneurship Panel',
    date: '2026-11-29',
    venue: 'MBA Block Auditorium',
    description: 'Founders and alumni discuss starting up from a college dorm room.',
    capacity: 150,
    category: 'Business',
  },
]

export const mockCategories = ['Technical', 'Cultural', 'Sports', 'Business']
