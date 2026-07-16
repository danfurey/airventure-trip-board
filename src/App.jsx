import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  days,
  decisionForEvent,
  decisionPoints,
  eventDateTime,
  events,
  eventsForDay,
  formatTime,
  minutes,
} from './data/schedule'
import { hasSharedBackend, supabase } from './lib/supabase'

const TRIP_ID = import.meta.env.VITE_TRIP_ID || '9f1153d5-e0cd-4a8f-8f28-f78da5a6d6e5'
const TRIP_NAME = import.meta.env.VITE_TRIP_NAME || 'AirVenture Weekend 2026'
const LOCAL_KEY = `airventure-trip-board:${TRIP_ID}`
const LOCAL_MEMBER_KEY = `airventure-trip-member:${TRIP_ID}`

const choiceLabels = {
  going: 'Want it',
  maybe: 'Maybe',
  skip: 'Skip',
}

function newId() {
  return globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function loadLocalData() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || { members: [], votes: [], groupChoices: [] }
  } catch {
    return { members: [], votes: [], groupChoices: [] }
  }
}

function saveLocalData(data) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
  window.dispatchEvent(new CustomEvent('airventure-local-change'))
}

function classNames(...values) {
  return values.filter(Boolean).join(' ')
}

function Icon({ name, size = 20 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  const paths = {
    decision: <><path d="M12 3v18"/><path d="m8 7 4-4 4 4"/><path d="m8 17 4 4 4-4"/><path d="M4 12h16"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></>,
    people: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    share: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></>,
    map: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    plane: <><path d="M22 2 9 15"/><path d="m15 3 4 4"/><path d="M9 15 3 13l2-2 5 1 2-5 2-2 1 6 4 4-2 2-5-1-1 5-2 2-1-6Z"/></>,
    wifi: <><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M8.5 16a6 6 0 0 1 7 0"/><path d="M12 20h.01"/></>,
    offline: <><path d="m2 2 20 20"/><path d="M8.5 16a6 6 0 0 1 3.5-1.1M5 12.55a11 11 0 0 1 2.1-1.1M14.5 15.1A6 6 0 0 1 15.5 16M17 11a11 11 0 0 1 2.08 1.55"/><path d="M12 20h.01"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></>,
    alert: <><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

function useTripData() {
  const [member, setMember] = useState(null)
  const [members, setMembers] = useState([])
  const [votes, setVotes] = useState([])
  const [groupChoices, setGroupChoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncState, setSyncState] = useState(hasSharedBackend ? 'connecting' : 'local')
  const [error, setError] = useState('')

  const hydrateLocal = useCallback(() => {
    const stored = loadLocalData()
    const memberId = localStorage.getItem(LOCAL_MEMBER_KEY)
    setMembers(stored.members || [])
    setVotes(stored.votes || [])
    setGroupChoices(stored.groupChoices || [])
    setMember((stored.members || []).find((item) => item.user_id === memberId) || null)
    setLoading(false)
    setSyncState('local')
  }, [])

  const fetchShared = useCallback(async (userId) => {
    if (!supabase || !userId) return
    const own = await supabase
      .from('trip_members')
      .select('*')
      .eq('trip_id', TRIP_ID)
      .eq('user_id', userId)
      .maybeSingle()

    if (own.error) throw own.error
    setMember(own.data || null)

    if (!own.data) {
      setMembers([])
      setVotes([])
      setGroupChoices([])
      setLoading(false)
      setSyncState('ready')
      return
    }

    const [memberResult, voteResult, choiceResult] = await Promise.all([
      supabase.from('trip_members').select('*').eq('trip_id', TRIP_ID).order('created_at'),
      supabase.from('votes').select('*').eq('trip_id', TRIP_ID),
      supabase.from('group_choices').select('*').eq('trip_id', TRIP_ID),
    ])
    const firstError = memberResult.error || voteResult.error || choiceResult.error
    if (firstError) throw firstError

    setMembers(memberResult.data || [])
    setVotes(voteResult.data || [])
    setGroupChoices(choiceResult.data || [])
    setLoading(false)
    setSyncState('ready')
  }, [])

  useEffect(() => {
    if (!hasSharedBackend) {
      hydrateLocal()
      const onChange = () => hydrateLocal()
      window.addEventListener('storage', onChange)
      window.addEventListener('airventure-local-change', onChange)
      return () => {
        window.removeEventListener('storage', onChange)
        window.removeEventListener('airventure-local-change', onChange)
      }
    }

    let mounted = true
    let channel
    async function start() {
      try {
        setSyncState('connecting')
        const { data: sessionData } = await supabase.auth.getSession()
        let session = sessionData.session
        if (!session) {
          const result = await supabase.auth.signInAnonymously()
          if (result.error) throw result.error
          session = result.data.session
        }
        if (!mounted || !session?.user) return
        await fetchShared(session.user.id)

        channel = supabase
          .channel(`airventure-${TRIP_ID}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_members', filter: `trip_id=eq.${TRIP_ID}` }, () => fetchShared(session.user.id))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: `trip_id=eq.${TRIP_ID}` }, () => fetchShared(session.user.id))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'group_choices', filter: `trip_id=eq.${TRIP_ID}` }, () => fetchShared(session.user.id))
          .subscribe((status) => setSyncState(status === 'SUBSCRIBED' ? 'ready' : 'connecting'))
      } catch (err) {
        console.error(err)
        if (mounted) {
          setError(err.message || 'Could not connect to the shared trip board.')
          setLoading(false)
          setSyncState('error')
        }
      }
    }
    start()
    return () => {
      mounted = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [fetchShared, hydrateLocal])

  async function saveName(displayName) {
    const cleanName = displayName.trim().slice(0, 40)
    if (!cleanName) return

    if (!hasSharedBackend) {
      let memberId = localStorage.getItem(LOCAL_MEMBER_KEY)
      if (!memberId) {
        memberId = newId()
        localStorage.setItem(LOCAL_MEMBER_KEY, memberId)
      }
      const stored = loadLocalData()
      const record = { trip_id: TRIP_ID, user_id: memberId, display_name: cleanName, created_at: new Date().toISOString() }
      stored.members = [...(stored.members || []).filter((item) => item.user_id !== memberId), record]
      saveLocalData(stored)
      hydrateLocal()
      return
    }

    setSyncState('saving')
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user?.id
    if (!userId) throw new Error('No active user session.')
    const result = await supabase.from('trip_members').upsert(
      { trip_id: TRIP_ID, user_id: userId, display_name: cleanName },
      { onConflict: 'trip_id,user_id' },
    )
    if (result.error) throw result.error
    await fetchShared(userId)
  }

  async function setVote(eventId, choice) {
    if (!member) return
    const existing = votes.find((vote) => vote.user_id === member.user_id && vote.event_id === eventId)
    const nextChoice = existing?.choice === choice ? null : choice

    if (!hasSharedBackend) {
      const stored = loadLocalData()
      stored.votes = (stored.votes || []).filter((vote) => !(vote.user_id === member.user_id && vote.event_id === eventId))
      if (nextChoice) {
        stored.votes.push({ trip_id: TRIP_ID, user_id: member.user_id, event_id: eventId, choice: nextChoice, updated_at: new Date().toISOString() })
      }
      saveLocalData(stored)
      hydrateLocal()
      return
    }

    setVotes((current) => {
      const remaining = current.filter((vote) => !(vote.user_id === member.user_id && vote.event_id === eventId))
      return nextChoice ? [...remaining, { trip_id: TRIP_ID, user_id: member.user_id, event_id: eventId, choice: nextChoice }] : remaining
    })

    const result = nextChoice
      ? await supabase.from('votes').upsert(
          { trip_id: TRIP_ID, user_id: member.user_id, event_id: eventId, choice: nextChoice, updated_at: new Date().toISOString() },
          { onConflict: 'trip_id,user_id,event_id' },
        )
      : await supabase.from('votes').delete().eq('trip_id', TRIP_ID).eq('user_id', member.user_id).eq('event_id', eventId)
    if (result.error) {
      setError(result.error.message)
      await fetchShared(member.user_id)
    }
  }

  async function setGroupChoice(decisionId, eventId) {
    if (!member) return

    // Group picks are event-level and fully reversible. More than one overlapping
    // event may be selected as an explicit override, so selecting a new event never
    // removes another event automatically.
    const clear = groupChoices.some((item) => item.event_id === eventId)
    const previousChoices = groupChoices
    const record = {
      trip_id: TRIP_ID,
      decision_id: decisionId,
      event_id: eventId,
      updated_by: member.user_id,
      updated_at: new Date().toISOString(),
    }
    const nextChoices = clear
      ? groupChoices.filter((item) => item.event_id !== eventId)
      : [...groupChoices.filter((item) => item.event_id !== eventId), record]

    // Optimistic update keeps Decisions and Schedule synchronized immediately.
    setGroupChoices(nextChoices)

    if (!hasSharedBackend) {
      const stored = loadLocalData()
      stored.groupChoices = nextChoices
      saveLocalData(stored)
      return
    }

    setSyncState('saving')
    const result = clear
      ? await supabase.from('group_choices').delete().eq('trip_id', TRIP_ID).eq('event_id', eventId)
      : await supabase.from('group_choices').upsert(record, { onConflict: 'trip_id,event_id' })

    if (result.error) {
      setGroupChoices(previousChoices)
      setError(result.error.message)
      await fetchShared(member.user_id)
    } else {
      setSyncState('ready')
    }
  }

  async function clearGroupChoices(eventIds = []) {
    if (!member) return
    const ids = [...new Set(eventIds)]
    if (!ids.length) return

    const previousChoices = groupChoices
    const nextChoices = groupChoices.filter((item) => !ids.includes(item.event_id))
    setGroupChoices(nextChoices)

    if (!hasSharedBackend) {
      const stored = loadLocalData()
      stored.groupChoices = nextChoices
      saveLocalData(stored)
      return
    }

    setSyncState('saving')
    const result = await supabase
      .from('group_choices')
      .delete()
      .eq('trip_id', TRIP_ID)
      .in('event_id', ids)

    if (result.error) {
      setGroupChoices(previousChoices)
      setError(result.error.message)
      await fetchShared(member.user_id)
    } else {
      setSyncState('ready')
    }
  }

  return {
    member,
    members,
    votes,
    groupChoices,
    loading,
    syncState,
    error,
    setError,
    saveName,
    setVote,
    setGroupChoice,
    clearGroupChoices,
  }
}

function SyncBadge({ state }) {
  const isLive = state === 'ready'
  const isLocal = state === 'local'
  return (
    <span className={classNames('sync-badge', isLive && 'live', state === 'error' && 'error')}>
      <Icon name={isLive ? 'wifi' : isLocal ? 'offline' : 'wifi'} size={15} />
      {isLive ? 'Live sync' : isLocal ? 'Device demo' : state === 'error' ? 'Sync error' : 'Connecting'}
    </span>
  )
}

function DayToggle({ activeDay, onChange }) {
  return (
    <div className="day-toggle" aria-label="Choose day">
      {days.map((day) => (
        <button key={day.id} className={activeDay === day.id ? 'active' : ''} onClick={() => onChange(day.id)}>
          <span>{day.shortLabel}</span>
          <small>{day.date.slice(5).replace('-', '/')}</small>
        </button>
      ))}
    </div>
  )
}

function VoteControls({ eventId, member, votes, onVote, compact = false }) {
  const myVote = votes.find((vote) => vote.user_id === member?.user_id && vote.event_id === eventId)?.choice
  return (
    <div className={classNames('vote-controls', compact && 'compact')} aria-label="Your interest">
      {Object.entries(choiceLabels).map(([choice, label]) => (
        <button
          key={choice}
          className={classNames(`vote-${choice}`, myVote === choice && 'selected')}
          onClick={() => onVote(eventId, choice)}
          aria-pressed={myVote === choice}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function VoteSummary({ eventId, votes, members }) {
  const eventVotes = votes.filter((vote) => vote.event_id === eventId)
  if (!eventVotes.length) return <span className="muted tiny">No votes yet</span>

  const counts = eventVotes.reduce((acc, vote) => {
    acc[vote.choice] = (acc[vote.choice] || 0) + 1
    return acc
  }, {})
  const wanting = eventVotes
    .filter((vote) => vote.choice === 'going')
    .map((vote) => members.find((member) => member.user_id === vote.user_id)?.display_name)
    .filter(Boolean)

  return (
    <div className="vote-summary">
      <span className="summary-pill strong">{counts.going || 0} want</span>
      <span className="summary-pill">{counts.maybe || 0} maybe</span>
      <span className="summary-pill subdued">{counts.skip || 0} skip</span>
      {wanting.length > 0 && <span className="wanting-names">{wanting.join(', ')}</span>}
    </div>
  )
}

function EventOption({ event, decision, selectedEventIds, selectedGroupEvents, member, members, votes, onVote, onGroupChoice }) {
  const selected = selectedEventIds?.has(event.id)
  const startingNow = decision.time === event.start
  const conflictingSelections = selected
    ? []
    : selectedGroupEvents.filter((picked) => picked.id !== event.id && picked.day === event.day && overlaps(event, picked))
  const isConflictMuted = conflictingSelections.length > 0 && event.category !== 'Demonstration'
  const conflictLabel = conflictingSelections.length === 1
    ? conflictingSelections[0].title
    : `${conflictingSelections.length} current group picks`

  return (
    <article className={classNames(
      'decision-option',
      selected && 'group-selected',
      isConflictMuted && 'conflict-muted',
      event.anchor && 'anchor-option',
    )}>
      <div className="option-main">
        <div className="option-title-row">
          <div>
            <div className="eyebrow-line">
              {startingNow ? 'Starts now' : `Continues until ${formatTime(event.end)}`}
              {event.anchor && <span className="anchor-tag">Anchor</span>}
            </div>
            <h3>{event.title}</h3>
          </div>
          {selected ? (
            <span className="group-pick-badge"><Icon name="check" size={14} /> Group pick</span>
          ) : isConflictMuted ? (
            <span className="override-conflict-badge"><Icon name="alert" size={13} /> Conflicts</span>
          ) : null}
        </div>
        <div className="event-meta">
          <span><Icon name="clock" size={15} /> {formatTime(event.start)}–{formatTime(event.end)}</span>
          <span><Icon name="map" size={15} /> {event.location}</span>
        </div>
        {isConflictMuted && (
          <p className="override-note">
            Conflicts with <strong>{conflictLabel}</strong>. It is grayed out, but you can still add it as an override.
          </p>
        )}
        <VoteSummary eventId={event.id} votes={votes} members={members} />
      </div>
      <div className="option-actions">
        <VoteControls eventId={event.id} member={member} votes={votes} onVote={onVote} compact />
        <button
          className={classNames('group-pick-button', selected && 'selected', isConflictMuted && 'override')}
          onClick={() => onGroupChoice(decision.id, event.id)}
        >
          {selected ? 'Clear group pick' : isConflictMuted ? 'Add override' : 'Set group pick'}
        </button>
      </div>
    </article>
  )
}

function DecisionCard({ decision, selectedEventIds, selectedGroupEvents, member, members, votes, onVote, onGroupChoice, defaultOpen = false }) {
  const selectedEvents = decision.active.filter((event) => selectedEventIds.has(event.id))
  const [open, setOpen] = useState(defaultOpen || selectedEvents.length > 0)
  const day = days.find((item) => item.id === decision.day)
  const now = new Date()
  const pointDate = new Date(`${day.date}T${decision.time}:00-05:00`)
  const isPast = now > new Date(pointDate.getTime() + 90 * 60 * 1000)
  const hasOverride = selectedEvents.some((event, index) => selectedEvents.slice(index + 1).some((other) => overlaps(event, other)))

  return (
    <section className={classNames('decision-card', selectedEvents.length > 0 && 'resolved', hasOverride && 'has-override', isPast && 'past')}>
      <button className="decision-heading" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <div className="decision-time-block">
          <span className="decision-time">{formatTime(decision.time)}</span>
          <span className="decision-count">{decision.active.length} overlapping choices</span>
        </div>
        <div className="decision-status-block">
          {selectedEvents.length > 0 ? (
            <>
              <span className={classNames('status', hasOverride ? 'override' : 'resolved')}>
                <Icon name={hasOverride ? 'alert' : 'check'} size={14} />
                {hasOverride ? 'Override active' : selectedEvents.length > 1 ? `${selectedEvents.length} group picks` : 'Group pick'}
              </span>
              <strong>
                {selectedEvents.length === 1
                  ? selectedEvents[0].title
                  : `${selectedEvents[0].title} + ${selectedEvents.length - 1} more`}
              </strong>
            </>
          ) : (
            <>
              <span className="status open"><Icon name="alert" size={14} /> Decide during trip</span>
              <strong>{decision.starting.length > 1 ? `${decision.starting.length} events start now` : `New option: ${decision.starting[0]?.title}`}</strong>
            </>
          )}
        </div>
        <span className={classNames('chevron', open && 'open')}><Icon name="chevron" /></span>
      </button>
      {open && (
        <div className="decision-options">
          {decision.active
            .slice()
            .sort((a, b) => {
              const aSelected = selectedEventIds.has(a.id)
              const bSelected = selectedEventIds.has(b.id)
              if (aSelected && !bSelected) return -1
              if (!aSelected && bSelected) return 1
              if (a.anchor && !b.anchor) return -1
              if (!a.anchor && b.anchor) return 1
              const aWant = votes.filter((vote) => vote.event_id === a.id && vote.choice === 'going').length
              const bWant = votes.filter((vote) => vote.event_id === b.id && vote.choice === 'going').length
              return bWant - aWant || minutes(a.start) - minutes(b.start)
            })
            .map((event) => (
              <EventOption
                key={event.id}
                event={event}
                decision={decision}
                selectedEventIds={selectedEventIds}
                selectedGroupEvents={selectedGroupEvents}
                member={member}
                members={members}
                votes={votes}
                onVote={onVote}
                onGroupChoice={onGroupChoice}
              />
            ))}
        </div>
      )}
    </section>
  )
}

function DecisionsView({ activeDay, member, members, votes, groupChoices, onVote, onGroupChoice }) {
  const points = decisionPoints.filter((point) => point.day === activeDay)
  const selectedEventIds = useMemo(() => new Set(groupChoices.map((choice) => choice.event_id)), [groupChoices])
  const selectedGroupEvents = useMemo(
    () => eventsForDay(activeDay).filter((event) => selectedEventIds.has(event.id) && !event.pending),
    [activeDay, selectedEventIds],
  )
  const resolved = points.filter((point) => point.active.some((event) => selectedEventIds.has(event.id))).length

  return (
    <main className="page-content">
      <div className="section-heading">
        <div>
          <span className="kicker">{days.find((day) => day.id === activeDay)?.label}</span>
          <h2>Points of decision</h2>
        </div>
        <span className="count-chip">{resolved}/{points.length} picked</span>
      </div>

      <div className="decision-list">
        {points.map((decision, index) => (
          <DecisionCard
            key={decision.id}
            decision={decision}
            selectedEventIds={selectedEventIds}
            selectedGroupEvents={selectedGroupEvents}
            member={member}
            members={members}
            votes={votes}
            onVote={onVote}
            onGroupChoice={onGroupChoice}
            defaultOpen={index === 0}
          />
        ))}
      </div>
    </main>
  )
}

const categoryPalette = {
  'Air Show': '#2b7de9',
  Military: '#7357d8',
  Engines: '#e98224',
  Workshop: '#159a78',
  Safety: '#d94a4a',
  Technology: '#198ca8',
  History: '#9a6848',
  Demonstration: '#c89a24',
  Forum: '#64748b',
  'Authors Corner': '#b64f84',
}

function overlaps(first, second) {
  return minutes(first.start) < minutes(second.end) && minutes(second.start) < minutes(first.end)
}

function selectedConflictIdsFor(selectedEvents) {
  const ids = new Set()
  selectedEvents.forEach((event, index) => {
    selectedEvents.slice(index + 1).forEach((other) => {
      if (event.day === other.day && overlaps(event, other)) {
        ids.add(event.id)
        ids.add(other.id)
      }
    })
  })
  return ids
}

function buildTimelineLayout(dayEvents) {
  const timed = dayEvents.filter((event) => !event.pending)
  const flexible = timed.filter((event) => event.flexible)
  const fixed = timed.filter((event) => !event.flexible)
  const earliest = Math.floor(Math.min(...timed.map((event) => minutes(event.start))) / 60) * 60
  const latest = Math.ceil(Math.max(...timed.map((event) => minutes(event.end))) / 60) * 60

  function assignLanes(source, laneOffset = 0) {
    const laneEnds = []
    return [...source]
      .sort((a, b) => minutes(a.start) - minutes(b.start) || minutes(a.end) - minutes(b.end))
      .map((event) => {
        const start = minutes(event.start)
        let lane = laneEnds.findIndex((end) => end <= start)
        if (lane === -1) lane = laneEnds.length
        laneEnds[lane] = minutes(event.end)
        return { event, lane: lane + laneOffset }
      })
  }

  const flexibleLayout = assignLanes(flexible)
  const fixedLayout = assignLanes(fixed, flexibleLayout.length ? Math.max(...flexibleLayout.map((item) => item.lane)) + 1 : 0)
  const layout = [...flexibleLayout, ...fixedLayout]
  const lanes = layout.length ? Math.max(...layout.map((item) => item.lane)) + 1 : 1
  const conflictedIds = new Set()

  fixed.forEach((event, index) => {
    fixed.slice(index + 1).forEach((other) => {
      if (overlaps(event, other)) {
        conflictedIds.add(event.id)
        conflictedIds.add(other.id)
      }
    })
  })

  const segments = []
  for (let point = earliest; point < latest; point += 15) {
    const count = fixed.filter((event) => minutes(event.start) <= point && minutes(event.end) > point).length
    segments.push({ point, count })
  }

  return { timed, layout, lanes, earliest, latest, conflictedIds, segments }
}

function Timeline({ dayEvents, activeDay, member, votes, groupChoices, onVote, onClearGroupChoices }) {
  const [focusedId, setFocusedId] = useState(null)
  const groupPickedIds = useMemo(() => new Set(groupChoices.map((choice) => choice.event_id)), [groupChoices])
  const selectedGroupEvents = useMemo(
    () => dayEvents.filter((event) => groupPickedIds.has(event.id) && !event.pending),
    [dayEvents, groupPickedIds],
  )
  const selectedOverrideIds = useMemo(() => selectedConflictIdsFor(selectedGroupEvents), [selectedGroupEvents])
  const hiddenConflictIds = useMemo(() => {
    const hidden = new Set()
    if (!selectedGroupEvents.length) return hidden

    dayEvents.forEach((event) => {
      if (event.pending || groupPickedIds.has(event.id) || event.category === 'Demonstration') return
      if (selectedGroupEvents.some((selected) => overlaps(event, selected))) hidden.add(event.id)
    })
    return hidden
  }, [dayEvents, groupPickedIds, selectedGroupEvents])
  const visibleDayEvents = useMemo(
    () => dayEvents.filter((event) => !hiddenConflictIds.has(event.id)),
    [dayEvents, hiddenConflictIds],
  )
  const { layout, lanes, earliest, latest, conflictedIds, segments } = useMemo(
    () => buildTimelineLayout(visibleDayEvents),
    [visibleDayEvents],
  )
  const duration = Math.max(60, latest - earliest)
  const pixelsPerMinute = 1.45
  const width = duration * pixelsPerMinute
  const rowHeight = 43
  const focused = visibleDayEvents.find((event) => event.id === focusedId && !event.pending)
  const hourMarks = []
  for (let point = earliest; point <= latest; point += 60) hourMarks.push(point)

  function voteFor(eventId) {
    return votes.find((vote) => vote.user_id === member?.user_id && vote.event_id === eventId)?.choice
  }

  return (
    <section className="timeline-card" aria-label={`${activeDay === 'sat' ? 'Saturday' : 'Sunday'} visual timeline`}>
      <div className="timeline-heading">
        <div>
          <span className="kicker">Visual day plan</span>
          <h2>Timeline and conflict map</h2>
          <p>Scroll sideways. Group picks automatically remove conflicting events, while demonstrations stay visible.</p>
        </div>
        <div className="timeline-conflict-key" aria-label="Conflict intensity legend">
          <span><i className="load-low" /> clear</span>
          <span><i className="load-medium" /> 2 overlap</span>
          <span><i className="load-high" /> 3+ overlap</span>
        </div>
      </div>

      {hiddenConflictIds.size > 0 && (
        <div className="timeline-filter-notice">
          <Icon name="check" size={16} />
          <span>
            <strong>{hiddenConflictIds.size} conflicting {hiddenConflictIds.size === 1 ? 'event' : 'events'} hidden</strong>
            Group picks are temporary. Clear them to restore the complete timeline. Demonstrations remain visible even when they overlap.
          </span>
          <button
            type="button"
            className="timeline-restore-button"
            onClick={() => onClearGroupChoices(selectedGroupEvents.map((event) => event.id))}
          >
            Restore all
          </button>
        </div>
      )}

      <div className="timeline-scroll">
        <div className="timeline-canvas" style={{ width: `${width}px` }}>
          <div className="timeline-ruler">
            {hourMarks.map((point) => (
              <div key={point} className="timeline-hour" style={{ left: `${(point - earliest) * pixelsPerMinute}px` }}>
                <span>{formatTime(`${String(Math.floor(point / 60)).padStart(2, '0')}:00`).replace(':00 ', ' ')}</span>
              </div>
            ))}
          </div>

          <div className="conflict-strip" aria-label="Conflict intensity by time">
            {segments.map((segment) => (
              <span
                key={segment.point}
                className={classNames('conflict-segment', segment.count >= 3 ? 'high' : segment.count === 2 ? 'medium' : 'low')}
                style={{ left: `${(segment.point - earliest) * pixelsPerMinute}px`, width: `${15 * pixelsPerMinute}px` }}
                title={`${formatTime(`${String(Math.floor(segment.point / 60)).padStart(2, '0')}:${String(segment.point % 60).padStart(2, '0')}`)} · ${segment.count} fixed event${segment.count === 1 ? '' : 's'}`}
              />
            ))}
          </div>

          <div className="timeline-grid" style={{ height: `${lanes * rowHeight + 10}px` }}>
            {hourMarks.map((point) => (
              <span key={point} className="timeline-gridline" style={{ left: `${(point - earliest) * pixelsPerMinute}px` }} />
            ))}
            {layout.map(({ event, lane }) => {
              const ownVote = voteFor(event.id)
              const isFocused = focusedId === event.id
              const conflict = conflictedIds.has(event.id)
              const isGroupPick = groupPickedIds.has(event.id)
              const isOverride = selectedOverrideIds.has(event.id)
              const left = (minutes(event.start) - earliest) * pixelsPerMinute
              const eventWidth = Math.max(34, (minutes(event.end) - minutes(event.start)) * pixelsPerMinute - 4)
              return (
                <button
                  key={event.id}
                  className={classNames(
                    'timeline-event',
                    conflict && 'has-conflict',
                    event.flexible && 'is-flexible',
                    isGroupPick && 'is-group-pick',
                    isOverride && 'is-override',
                    ownVote && `is-${ownVote}`,
                    isFocused && 'is-focused',
                  )}
                  style={{
                    left: `${left}px`,
                    top: `${lane * rowHeight + 5}px`,
                    width: `${eventWidth}px`,
                    '--event-color': categoryPalette[event.category] || '#64748b',
                  }}
                  onClick={() => setFocusedId(event.id)}
                  title={`${formatTime(event.start)}–${formatTime(event.end)} · ${event.title}`}
                >
                  <span className="timeline-event-time">{formatTime(event.start).replace(' AM', '').replace(' PM', '')}</span>
                  <strong>{event.title}</strong>
                  {isGroupPick && <span className="timeline-pick-mark"><Icon name="check" size={12} /></span>}
                  {isOverride && <span className="timeline-override-mark">OVR</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="timeline-legend" aria-label="Event colors">
        {Object.entries(categoryPalette).map(([category, color]) => (
          <span key={category}><i style={{ background: color }} />{category}</span>
        ))}
      </div>

      {focused ? (
        <div className="timeline-focus-card">
          <div className="timeline-focus-main">
            <span className="timeline-focus-time">{formatTime(focused.start)}–{formatTime(focused.end)}</span>
            <strong>{focused.title}</strong>
            <span><Icon name="map" size={14} /> {focused.location}</span>
            {selectedOverrideIds.has(focused.id) ? (
              <em className="override-focus"><Icon name="alert" size={14} /> Override: conflicts with another selected group event</em>
            ) : conflictedIds.has(focused.id) ? (
              <em><Icon name="alert" size={14} /> Conflicts with another fixed event</em>
            ) : null}
          </div>
          <VoteControls eventId={focused.id} member={member} votes={votes} onVote={onVote} compact />
        </div>
      ) : (
        <div className="timeline-tap-hint">Tap any colored event bar for details and voting.</div>
      )}
    </section>
  )
}

function EventCard({ event, member, members, votes, onVote, groupPickedIds, selectedOverrideIds }) {
  const conflicts = decisionForEvent(event.id)
  const isGroupPick = groupPickedIds.has(event.id)
  const isOverride = selectedOverrideIds.has(event.id)
  return (
    <article id={`event-${event.id}`} className={classNames(
      'schedule-event',
      event.anchor && 'anchor-event',
      event.flexible && 'flex-event',
      event.pending && 'pending-event',
      isGroupPick && 'group-picked-event',
      isOverride && 'override-picked-event',
    )}>
      <div className="schedule-time">
        <strong>{event.pending ? 'TBD' : formatTime(event.start)}</strong>
        {!event.pending && <small>{formatTime(event.end)}</small>}
      </div>
      <div className="schedule-body">
        <div className="schedule-tags">
          <span className="category-label"><i style={{ background: categoryPalette[event.category] || '#64748b' }} />{event.category}</span>
          {event.anchor && <span className="anchor-tag">Anchor</span>}
          {event.flexible && <span className="flex-tag">Flexible window</span>}
          {conflicts.length > 0 && !event.flexible && <span className="conflict-tag">Decision point</span>}
          {isGroupPick && <span className="schedule-pick-tag"><Icon name="check" size={11} /> Group pick</span>}
          {isOverride && <span className="schedule-override-tag"><Icon name="alert" size={11} /> Override</span>}
        </div>
        <h3>{event.title}</h3>
        <p><Icon name="map" size={15} /> {event.location}</p>
        {event.pending && <p className="pending-note">The screenshot did not include a complete time. Add it when confirmed.</p>}
        {!event.pending && <VoteSummary eventId={event.id} votes={votes} members={members} />}
        {!event.pending && <VoteControls eventId={event.id} member={member} votes={votes} onVote={onVote} compact />}
      </div>
    </article>
  )
}

function ScheduleView({ activeDay, member, members, votes, groupChoices, onVote, onClearGroupChoices }) {
  const dayEvents = eventsForDay(activeDay)
  const groupPickedIds = useMemo(() => new Set(groupChoices.map((choice) => choice.event_id)), [groupChoices])
  const selectedGroupEvents = useMemo(
    () => dayEvents.filter((event) => groupPickedIds.has(event.id) && !event.pending),
    [dayEvents, groupPickedIds],
  )
  const selectedOverrideIds = useMemo(() => selectedConflictIdsFor(selectedGroupEvents), [selectedGroupEvents])

  return (
    <main className="page-content">
      <Timeline
        dayEvents={dayEvents}
        activeDay={activeDay}
        member={member}
        votes={votes}
        groupChoices={groupChoices}
        onVote={onVote}
        onClearGroupChoices={onClearGroupChoices}
      />

      <div className="section-heading schedule-list-heading">
        <div>
          <span className="kicker">Event details</span>
          <h2>Full schedule</h2>
        </div>
        <span className="count-chip">{dayEvents.length} events</span>
      </div>

      <div className="schedule-list">
        {dayEvents.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            member={member}
            members={members}
            votes={votes}
            onVote={onVote}
            groupPickedIds={groupPickedIds}
            selectedOverrideIds={selectedOverrideIds}
          />
        ))}
      </div>
    </main>
  )
}

function GroupView({ member, members, votes, groupChoices, onEditName }) {
  const memberStats = members.map((person) => {
    const personVotes = votes.filter((vote) => vote.user_id === person.user_id)
    return {
      ...person,
      wants: personVotes.filter((vote) => vote.choice === 'going').length,
      maybes: personVotes.filter((vote) => vote.choice === 'maybe').length,
    }
  })

  const popular = events
    .filter((event) => !event.pending)
    .map((event) => ({
      event,
      wants: votes.filter((vote) => vote.event_id === event.id && vote.choice === 'going').length,
      maybes: votes.filter((vote) => vote.event_id === event.id && vote.choice === 'maybe').length,
    }))
    .filter((item) => item.wants || item.maybes)
    .sort((a, b) => b.wants - a.wants || b.maybes - a.maybes)
    .slice(0, 6)

  return (
    <main className="page-content">
      <section className="group-hero">
        <div>
          <span className="kicker">Travel group</span>
          <h1>{members.length} {members.length === 1 ? 'person' : 'people'} on the board.</h1>
          <p>Each phone keeps its own identity. Votes and group picks synchronize in shared mode.</p>
        </div>
        <button className="secondary-button" onClick={onEditName}><Icon name="edit" size={16} /> Edit my name</button>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>People</h2>
          <span className="count-chip">{groupChoices.length} group picks</span>
        </div>
        <div className="member-list">
          {memberStats.map((person) => (
            <div className="member-row" key={person.user_id}>
              <div className="avatar">{person.display_name.slice(0, 1).toUpperCase()}</div>
              <div className="member-name">
                <strong>{person.display_name}</strong>
                {person.user_id === member?.user_id && <span>You</span>}
              </div>
              <div className="member-counts">
                <span><strong>{person.wants}</strong> want</span>
                <span><strong>{person.maybes}</strong> maybe</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading"><h2>Most wanted</h2></div>
        {popular.length ? (
          <div className="popular-list">
            {popular.map(({ event, wants, maybes }) => (
              <div className="popular-row" key={event.id}>
                <div>
                  <strong>{event.title}</strong>
                  <span>{days.find((day) => day.id === event.day)?.shortLabel} · {formatTime(event.start)}</span>
                </div>
                <div className="popular-score"><strong>{wants}</strong><span>want</span><small>{maybes} maybe</small></div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">No one has voted yet.</p>
        )}
      </section>

      <section className="privacy-note">
        <Icon name="wifi" />
        <div>
          <strong>{hasSharedBackend ? 'Shared realtime mode' : 'Local demo mode'}</strong>
          <p>{hasSharedBackend ? 'Changes update across your group’s phones through Supabase.' : 'This copy works on one device. Add Supabase environment variables before sending the link to friends.'}</p>
        </div>
      </section>
    </main>
  )
}

function NameModal({ currentName, onSave, canClose }) {
  const [name, setName] = useState(currentName || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      await onSave(name)
    } catch (err) {
      setError(err.message || 'Could not save your name.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <form className="name-modal" onSubmit={submit}>
        <div className="modal-plane"><Icon name="plane" size={34} /></div>
        <span className="kicker">Join the trip board</span>
        <h2>What should your friends see?</h2>
        <p>Use a first name or nickname. This device will remember it.</p>
        <label>
          Display name
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Dan" maxLength={40} />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" type="submit" disabled={saving || !name.trim()}>{saving ? 'Joining…' : 'Join trip board'}</button>
        {canClose && <small>Saving replaces your current display name.</small>}
      </form>
    </div>
  )
}

function App() {
  const trip = useTripData()
  const [activeTab, setActiveTab] = useState('decisions')
  const [activeDay, setActiveDay] = useState('sat')
  const [editingName, setEditingName] = useState(false)
  const [toast, setToast] = useState('')

  const upcomingDay = useMemo(() => {
    const now = new Date()
    const sundayEnd = new Date('2026-07-26T17:00:00-05:00')
    if (now >= new Date('2026-07-26T00:00:00-05:00') && now <= sundayEnd) return 'sun'
    return 'sat'
  }, [])

  useEffect(() => setActiveDay(upcomingDay), [upcomingDay])

  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    }
  }, [])

  async function shareTrip() {
    const shareData = {
      title: TRIP_NAME,
      text: 'Open our shared AirVenture schedule and decision board.',
      url: window.location.href,
    }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(window.location.href)
        setToast('Trip link copied')
      }
    } catch (err) {
      if (err?.name !== 'AbortError') setToast('Could not share the link')
    }
  }

  if (trip.loading) {
    return (
      <div className="loading-screen">
        <div className="loading-plane"><Icon name="plane" size={42} /></div>
        <strong>Loading trip board</strong>
        <span>Preparing schedule and group choices…</span>
      </div>
    )
  }

  const needsName = !trip.member || editingName

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark"><Icon name="plane" size={24} /></div>
          <div>
            <strong>{TRIP_NAME}</strong>
            <span>July 25–26 · Oshkosh</span>
          </div>
        </div>
        <div className="header-actions">
          <SyncBadge state={trip.syncState} />
          <button className="icon-button" onClick={shareTrip} aria-label="Share trip"><Icon name="share" /></button>
        </div>
      </header>

      {trip.error && (
        <div className="error-banner">
          <Icon name="alert" size={18} />
          <span>{trip.error}</span>
          <button onClick={() => trip.setError('')}>Dismiss</button>
        </div>
      )}

      {(activeTab === 'decisions' || activeTab === 'schedule') && (
        <div className="sticky-day-bar"><DayToggle activeDay={activeDay} onChange={setActiveDay} /></div>
      )}

      {activeTab === 'decisions' && (
        <DecisionsView
          activeDay={activeDay}
          member={trip.member}
          members={trip.members}
          votes={trip.votes}
          groupChoices={trip.groupChoices}
          onVote={trip.setVote}
          onGroupChoice={trip.setGroupChoice}
        />
      )}
      {activeTab === 'schedule' && (
        <ScheduleView activeDay={activeDay} member={trip.member} members={trip.members} votes={trip.votes} groupChoices={trip.groupChoices} onVote={trip.setVote} onClearGroupChoices={trip.clearGroupChoices} />
      )}
      {activeTab === 'group' && (
        <GroupView
          member={trip.member}
          members={trip.members}
          votes={trip.votes}
          groupChoices={trip.groupChoices}
          onEditName={() => setEditingName(true)}
        />
      )}

      <nav className="bottom-nav" aria-label="Main navigation">
        <button className={activeTab === 'decisions' ? 'active' : ''} onClick={() => setActiveTab('decisions')}>
          <Icon name="decision" /><span>Decisions</span>
        </button>
        <button className={activeTab === 'schedule' ? 'active' : ''} onClick={() => setActiveTab('schedule')}>
          <Icon name="calendar" /><span>Schedule</span>
        </button>
        <button className={activeTab === 'group' ? 'active' : ''} onClick={() => setActiveTab('group')}>
          <Icon name="people" /><span>Group</span>
        </button>
      </nav>

      {needsName && (
        <NameModal
          currentName={trip.member?.display_name}
          canClose={Boolean(trip.member)}
          onSave={async (name) => {
            await trip.saveName(name)
            setEditingName(false)
          }}
        />
      )}

      {toast && <div className="toast" onAnimationEnd={() => setToast('')}>{toast}</div>}
    </div>
  )
}

export default App
