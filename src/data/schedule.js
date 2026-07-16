export const TRIP_TIME_ZONE = 'America/Chicago'

export const days = [
  { id: 'sat', label: 'Saturday', shortLabel: 'Sat', date: '2026-07-25' },
  { id: 'sun', label: 'Sunday', shortLabel: 'Sun', date: '2026-07-26' },
]

export const events = [
  { id: 'sat-icarus-display', day: 'sat', start: '08:00', end: '17:00', title: 'John Moody Icarus II Display', location: 'Ultralight Workshop Tent', category: 'Demonstration', flexible: true },
  { id: 'sat-open-sim-0800', day: 'sat', start: '08:00', end: '09:30', title: 'Open Sim', location: 'EAA Pilot Proficiency Center', category: 'Workshop' },
  { id: 'sat-x-planes', day: 'sat', start: '08:30', end: '09:45', title: '80 Years of X-Planes Past and Present', location: 'EAA Museum – Vette Theater', category: 'History' },
  { id: 'sat-composite-101', day: 'sat', start: '08:30', end: '09:45', title: 'Composite 101', location: 'Workshop Classroom A', category: 'Workshop' },
  { id: 'sat-cozy-build', day: 'sat', start: '08:30', end: '14:30', title: 'Cozy Aircraft Build', location: 'Aeroplane Workshop', category: 'Demonstration', flexible: true },
  { id: 'sat-flight-training', day: 'sat', start: '08:30', end: '09:45', title: 'Flight Training Strategy', location: 'Forum Stage 11', category: 'Forum' },
  { id: 'sat-gas-welding', day: 'sat', start: '08:30', end: '09:45', title: 'Gas Welding 101', location: 'Gas Welding Workshop', category: 'Workshop' },
  { id: 'sat-bateleurs', day: 'sat', start: '08:30', end: '09:45', title: 'The Bateleurs: Volunteers Flying', location: 'Forum Stage 1', category: 'Forum' },
  { id: 'sat-wood-construction', day: 'sat', start: '08:30', end: '09:45', title: 'Wood Construction 101', location: 'Wood Workshop', category: 'Workshop' },
  { id: 'sat-rotax', day: 'sat', start: '09:00', end: '10:30', title: 'Intro to Rotax Aircraft Engines', location: 'Rotax Aircraft Engines Booth', category: 'Engines' },
  { id: 'sat-prop-strike', day: 'sat', start: '09:00', end: '09:45', title: 'Planes, Trains, and a Prop Strike (WINGS Credit)', location: 'AOPA Program Pavilion', category: 'Safety' },
  { id: 'sat-open-sim-0930', day: 'sat', start: '09:30', end: '11:00', title: 'Open Sim', location: 'EAA Pilot Proficiency Center', category: 'Workshop' },
  { id: 'sat-lycoming-reassembly', day: 'sat', start: '09:30', end: '11:30', title: 'Reassembly of Lycoming Engines', location: 'Lycoming Engines Booth 277', category: 'Engines' },
  { id: 'sat-tfr', day: 'sat', start: '09:30', end: '10:15', title: 'TFR: Avoid a Fighter Intercept', location: 'International Federal Pavilion', category: 'Safety' },
  { id: 'sat-book-callsign', day: 'sat', start: '10:00', end: '11:00', title: "Book One: The Flipside; Book Two: Upside Down Dreams; Book Three: What's Your Callsign", location: 'EAA Warehouse', category: 'Authors Corner' },
  { id: 'sat-rc-lessons', day: 'sat', start: '10:00', end: '11:15', title: 'How to Bring RC Model Aviation Lessons and Activities Into Your EAA Chapter', location: 'EAA Blue Barn', category: 'Forum' },
  { id: 'sat-lycoming-install', day: 'sat', start: '10:00', end: '11:15', title: 'Lycoming Engines Installation', location: 'Forum Stage 3', category: 'Engines' },
  { id: 'sat-blue-angels-test', day: 'sat', start: '10:00', end: '11:15', title: 'Naval Flight Test: Blue Angels', location: 'Forum Stage 6', category: 'Military' },
  { id: 'sat-september-11', day: 'sat', start: '10:00', end: '11:15', title: 'September 11, 2001: We Remember', location: 'Forum Stage 5', category: 'History' },
  { id: 'sat-open-sim-1100', day: 'sat', start: '11:00', end: '12:30', title: 'Open Sim', location: 'EAA Pilot Proficiency Center', category: 'Workshop' },
  { id: 'sat-mig-pilot', day: 'sat', start: '11:30', end: '12:45', title: 'American MiG Pilot', location: 'Forum Stage 3', category: 'Military' },
  { id: 'sat-radar', day: 'sat', start: '11:30', end: '12:45', title: 'History and Future of Radar', location: 'Forum Stage 11', category: 'Technology' },
  { id: 'sat-rotorcraft', day: 'sat', start: '11:30', end: '14:00', title: 'Homebuilt Rotorcraft', location: 'Fun Fly Zone', category: 'Demonstration', flexible: true },
  { id: 'sat-drones', day: 'sat', start: '11:30', end: '12:45', title: 'So You Want to Work With Drones?', location: 'Forum Stage 4', category: 'Technology' },
  { id: 'sat-allison-run', day: 'sat', start: '11:45', end: '12:00', title: 'Allison V-1710 Engine Run', location: 'Boeing Plaza', category: 'Demonstration' },
  { id: 'sat-flak-bait', day: 'sat', start: '12:30', end: '13:30', title: 'Flak-Bait: Assembling an Icon, Fighting the Past', location: 'NASM Tent Booth 328', category: 'History' },
  { id: 'sat-f117', day: 'sat', start: '13:00', end: '14:15', title: 'Flying the F-117 Stealth Fighter', location: 'Forum Stage 7', category: 'Military' },
  { id: 'sat-armless-pilot', day: 'sat', start: '13:00', end: '13:45', title: "The Armless Pilot's Impossible Airplane", location: 'AOPA Program Pavilion', category: 'Forum' },
  { id: 'sat-redbird', day: 'sat', start: '13:30', end: '15:30', title: 'Redbird Challenge Cup: Compete to Win!', location: 'Redbird Sim Lab', category: 'Workshop' },
  { id: 'sat-b1-bomber', day: 'sat', start: '14:00', end: '15:00', title: 'The Supersonic BONE: A Development and Operational History of the B-1 Bomber', location: 'EAA Warehouse', category: 'Military' },
  { id: 'sat-daily-airshow', day: 'sat', start: '14:15', end: '18:15', title: 'Daily Air Show Presented by Daher', location: 'Flightline', category: 'Air Show', anchor: true },
  { id: 'sat-f16-agcas', day: 'sat', start: '14:30', end: '15:15', title: '1 Second to Live: F-16 AGCAS Saves', location: 'International Federal Pavilion', category: 'Safety' },
  { id: 'sat-womenventure-airshow', day: 'sat', start: '14:30', end: '15:45', title: 'Daily Air Show', location: 'EAA WomenVenture Center', category: 'Forum' },
  { id: 'sat-open-sim-1430', day: 'sat', start: '14:30', end: '16:00', title: 'Open Sim', location: 'EAA Pilot Proficiency Center', category: 'Workshop' },
  { id: 'sat-renaissance-aviator', day: 'sat', start: '16:00', end: '17:00', title: 'The Renaissance Aviator', location: 'EAA Warehouse', category: 'Authors Corner' },
  { id: 'sat-night-airshow', day: 'sat', start: '20:00', end: '22:00', title: 'Saturday Night Air Show Presented by Hartzell Propeller', location: 'Flightline', category: 'Air Show', anchor: true },

  { id: 'sun-gas-welding', day: 'sun', start: '08:30', end: '09:45', title: 'Gas Welding 101', location: 'Gas Welding Workshop', category: 'Workshop' },
  { id: 'sun-sheet-metal', day: 'sun', start: '08:30', end: '10:30', title: 'Sheet Metal 101', location: 'Sheet Metal Workshop', category: 'Workshop' },
  { id: 'sun-wood-construction', day: 'sun', start: '08:30', end: '09:45', title: 'Wood Construction 101', location: 'Wood Workshop', category: 'Workshop' },
  { id: 'sun-allison-run', day: 'sun', start: '11:45', end: '12:00', title: 'Allison V-1710 Engine Run', location: 'Boeing Plaza', category: 'Demonstration' },
  { id: 'sun-daily-airshow', day: 'sun', start: '13:00', end: '17:00', title: 'Daily Air Show Presented by Daher', location: 'Flightline', category: 'Air Show', anchor: true },

  { id: 'sat-rivet-pending', day: 'sat', title: 'How One Little Rivet Changed My Life', location: 'EAA WomenVenture Center', category: 'Forum', pending: true },
  { id: 'sat-mission-marge-pending', day: 'sat', title: 'Mission Marge', location: 'Theater in the Woods', category: 'History', pending: true },
]

export const categoryOrder = [
  'Air Show',
  'Military',
  'Engines',
  'Workshop',
  'Safety',
  'Technology',
  'History',
  'Demonstration',
  'Forum',
  'Authors Corner',
]

export function minutes(time) {
  if (!time) return null
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

export function formatTime(time) {
  if (!time) return 'Time pending'
  const [hour, minute] = time.split(':').map(Number)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`
}

export function eventDateTime(event, edge = 'start') {
  const day = days.find((item) => item.id === event.day)
  const value = event[edge]
  if (!day || !value) return null
  return new Date(`${day.date}T${value}:00-05:00`)
}

export function eventsForDay(dayId) {
  return events
    .filter((event) => event.day === dayId)
    .sort((a, b) => {
      if (a.pending && !b.pending) return 1
      if (!a.pending && b.pending) return -1
      return (minutes(a.start) ?? 9999) - (minutes(b.start) ?? 9999)
    })
}

export function buildDecisionPoints(dayId) {
  const fixed = eventsForDay(dayId).filter((event) => !event.pending && !event.flexible)
  const starts = [...new Set(fixed.map((event) => event.start))].sort((a, b) => minutes(a) - minutes(b))

  return starts
    .map((start) => {
      const point = minutes(start)
      const active = fixed.filter((event) => minutes(event.start) <= point && minutes(event.end) > point)
      const starting = active.filter((event) => event.start === start)
      return {
        id: `${dayId}-${start.replace(':', '')}`,
        day: dayId,
        time: start,
        active,
        starting,
      }
    })
    .filter((point) => point.active.length > 1 && point.starting.length > 0)
}

export const decisionPoints = days.flatMap((day) => buildDecisionPoints(day.id))

export function decisionForEvent(eventId) {
  return decisionPoints.filter((point) => point.active.some((event) => event.id === eventId))
}
