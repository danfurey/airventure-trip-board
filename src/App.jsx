import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { browserLocalPersistence, setPersistence, signInAnonymously } from 'firebase/auth'
import { collection, deleteDoc, disableNetwork, doc, enableNetwork, getDocsFromServer, onSnapshot, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
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
import { auth, db, firebaseProjectId, hasSharedBackend } from './lib/firebase'

const TRIP_ID = import.meta.env.VITE_TRIP_ID || '9f1153d5-e0cd-4a8f-8f28-f78da5a6d6e5'
const TRIP_NAME = import.meta.env.VITE_TRIP_NAME || 'AirVenture Weekend 2026'
const LOCAL_KEY = `airventure-trip-board:${TRIP_ID}`

const choiceLabels = {
  going: 'Attend',
  maybe: 'Maybe',
  skip: 'Skip',
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

function cacheSharedData(partial) {
  const current = loadLocalData()
  localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...current, ...partial }))
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

function normalizeFirebaseRecord(snapshot) {
  const data = snapshot.data()
  const normalizeTime = (value) => value?.toDate?.().toISOString?.() || value || null
  return {
    ...data,
    created_at: normalizeTime(data.created_at),
    updated_at: normalizeTime(data.updated_at),
  }
}

function useTripData() {
  const sharedMember = useMemo(() => ({ trip_id: TRIP_ID, user_id: 'shared-board', display_name: 'Shared board' }), [])
  const initialData = useMemo(() => loadLocalData(), [])
  const [votes, setVotes] = useState(() => initialData.votes || [])
  const [groupChoices, setGroupChoices] = useState(() => initialData.groupChoices || [])
  const [error, setError] = useState('')
  const [connectionIssue, setConnectionIssue] = useState('')
  const [backendUserId, setBackendUserId] = useState(null)
  const [serverReady, setServerReady] = useState(!hasSharedBackend)
  const [cacheSeen, setCacheSeen] = useState(Boolean((initialData.votes || []).length || (initialData.groupChoices || []).length))
  const [connectionPhase, setConnectionPhase] = useState(hasSharedBackend ? 'auth' : 'local')
  const [connectionStartedAt, setConnectionStartedAt] = useState(() => Date.now())
  const [connectionElapsed, setConnectionElapsed] = useState(0)
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [listenerFromCache, setListenerFromCache] = useState(hasSharedBackend)
  const [listenerHasPendingWrites, setListenerHasPendingWrites] = useState(false)
  const [pendingWrites, setPendingWrites] = useState(0)
  const serverReadyRef = useRef(!hasSharedBackend)
  const votesRef = useRef(votes)
  const groupChoicesRef = useRef(groupChoices)

  useEffect(() => { votesRef.current = votes }, [votes])
  useEffect(() => { groupChoicesRef.current = groupChoices }, [groupChoices])

  const hydrateLocal = useCallback(() => {
    const stored = loadLocalData()
    setVotes(stored.votes || [])
    setGroupChoices(stored.groupChoices || [])
  }, [])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (!hasSharedBackend || serverReady || error) return undefined
    const updateElapsed = () => setConnectionElapsed(Math.max(0, Math.floor((Date.now() - connectionStartedAt) / 1000)))
    updateElapsed()
    const intervalId = window.setInterval(updateElapsed, 1000)
    return () => window.clearInterval(intervalId)
  }, [connectionStartedAt, error, serverReady])

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

    let cancelled = false
    let unsubscribeVotes = () => {}
    let unsubscribeChoices = () => {}
    let noResponseTimer = 0
    const serverConfirmed = { votes: false, choices: false }
    const sourceFromCache = { votes: true, choices: true }
    const sourceHasPendingWrites = { votes: false, choices: false }

    function friendlyConnectionError(err) {
      const code = err?.code || 'unknown'
      const messages = {
        'auth/operation-not-allowed': 'Anonymous sign-in is disabled in Firebase Authentication.',
        'auth/network-request-failed': 'Firebase Authentication could not reach Google. Check the network, VPN, firewall, or browser privacy settings.',
        'permission-denied': 'Firestore rejected the request. Publish the included Firestore rules and confirm Anonymous Authentication is enabled.',
        'unauthenticated': 'Firestore did not receive a valid Firebase user session.',
        'failed-precondition': 'Firestore is not ready for this project. Confirm that the Firestore database was created.',
        'not-found': 'The Firestore database or requested project could not be found. Check the Firebase project ID.',
        'unavailable': 'Firestore is currently unreachable from this browser or network.',
        'deadline-exceeded': 'Firestore did not respond before the request deadline.',
      }
      return `${messages[code] || err?.message || 'Firebase connection failed.'} [${code}]`
    }

    function isFatalConnectionError(err) {
      return ['auth/operation-not-allowed', 'permission-denied', 'unauthenticated', 'failed-precondition', 'not-found', 'invalid-argument'].includes(err?.code)
    }

    function applyRecords(name, records) {
      if (name === 'votes') {
        votesRef.current = records
        setVotes(records)
        cacheSharedData({ votes: records })
      } else {
        groupChoicesRef.current = records
        setGroupChoices(records)
        cacheSharedData({ groupChoices: records })
      }
    }

    function confirmServer(name, records) {
      if (cancelled) return
      applyRecords(name, records)
      serverConfirmed[name] = true
      sourceFromCache[name] = false
      setListenerFromCache(sourceFromCache.votes || sourceFromCache.choices)

      if (serverConfirmed.votes && serverConfirmed.choices) {
        serverReadyRef.current = true
        setServerReady(true)
        setConnectionPhase('live')
        setConnectionIssue('')
        setError('')
        window.clearTimeout(noResponseTimer)
      }
    }

    function handleSnapshot(name, snapshot) {
      if (cancelled) return
      sourceFromCache[name] = snapshot.metadata.fromCache
      sourceHasPendingWrites[name] = snapshot.metadata.hasPendingWrites
      setListenerFromCache(sourceFromCache.votes || sourceFromCache.choices)
      setListenerHasPendingWrites(sourceHasPendingWrites.votes || sourceHasPendingWrites.choices)

      const records = snapshot.docs.map(normalizeFirebaseRecord)
      if (!snapshot.metadata.fromCache) {
        confirmServer(name, records)
      } else {
        setCacheSeen(true)
        // Before server confirmation, localStorage remains the provisional display.
        // After live sync, optimistic writes are already applied directly by the UI.
      }
    }

    function handleFirestoreError(err) {
      console.error('Firestore connection error:', err)
      const message = friendlyConnectionError(err)
      if (isFatalConnectionError(err)) {
        setConnectionPhase('error')
        setError(message)
      } else {
        setConnectionPhase('retrying')
        setConnectionIssue(message)
      }
    }

    async function connect() {
      serverReadyRef.current = false
      setServerReady(false)
      setBackendUserId(null)
      setError('')
      setConnectionIssue('')
      setConnectionPhase('auth')
      setConnectionStartedAt(Date.now())
      setConnectionElapsed(0)
      setListenerFromCache(true)

      try {
        await setPersistence(auth, browserLocalPersistence)
        await auth.authStateReady()
        if (cancelled) return

        let user = auth.currentUser
        if (!user) {
          const credential = await signInAnonymously(auth)
          user = credential.user
        }
        if (cancelled) return

        setBackendUserId(user.uid)
        setConnectionPhase('firestore')
        setConnectionStartedAt(Date.now())
        setConnectionElapsed(0)

        await enableNetwork(db)
        if (cancelled) return

        const votesCollection = collection(db, 'trips', TRIP_ID, 'votes')
        const choicesCollection = collection(db, 'trips', TRIP_ID, 'groupChoices')

        unsubscribeVotes = onSnapshot(
          votesCollection,
          { includeMetadataChanges: true },
          (snapshot) => handleSnapshot('votes', snapshot),
          handleFirestoreError,
        )
        unsubscribeChoices = onSnapshot(
          choicesCollection,
          { includeMetadataChanges: true },
          (snapshot) => handleSnapshot('choices', snapshot),
          handleFirestoreError,
        )

        // One-shot server reads make startup deterministic and expose rules,
        // project, or database errors instead of waiting forever on listeners.
        getDocsFromServer(votesCollection)
          .then((snapshot) => confirmServer('votes', snapshot.docs.map(normalizeFirebaseRecord)))
          .catch(handleFirestoreError)
        getDocsFromServer(choicesCollection)
          .then((snapshot) => confirmServer('choices', snapshot.docs.map(normalizeFirebaseRecord)))
          .catch(handleFirestoreError)

        noResponseTimer = window.setTimeout(() => {
          if (cancelled || serverReadyRef.current) return
          setConnectionPhase('retrying')
          setConnectionIssue(
            `No Firestore server response after 12 seconds. Firebase is configured for compatibility mode and is still listening. Project: ${firebaseProjectId || 'unknown'}.`
          )
        }, 12000)
      } catch (err) {
        console.error('Firebase startup error:', err)
        const message = friendlyConnectionError(err)
        if (isFatalConnectionError(err) || String(err?.code || '').startsWith('auth/')) {
          setConnectionPhase('error')
          setError(message)
        } else {
          setConnectionPhase('retrying')
          setConnectionIssue(message)
        }
      }
    }

    connect()
    return () => {
      cancelled = true
      window.clearTimeout(noResponseTimer)
      unsubscribeVotes()
      unsubscribeChoices()
    }
  }, [connectionAttempt, hydrateLocal])

  const retryFirebase = useCallback(async () => {
    if (!hasSharedBackend) return
    setError('')
    setConnectionIssue('')
    setConnectionPhase('restarting')
    setConnectionStartedAt(Date.now())
    setConnectionElapsed(0)
    serverReadyRef.current = false
    setServerReady(false)
    try {
      await disableNetwork(db)
      await enableNetwork(db)
    } catch (err) {
      console.warn('Firestore network restart did not complete cleanly:', err)
    }
    setConnectionAttempt((attempt) => attempt + 1)
  }, [])

  const canEdit = !hasSharedBackend || serverReady
  const syncState = useMemo(() => {
    if (!hasSharedBackend) return 'local'
    if (error) return 'error'
    if (!isOnline) return 'offline'
    if (!serverReady) {
      if (connectionIssue || connectionElapsed >= 12) return 'retrying'
      return cacheSeen ? 'cached' : 'connecting'
    }
    if (pendingWrites > 0 || listenerHasPendingWrites) return 'saving'
    if (listenerFromCache) return 'reconnecting'
    return 'ready'
  }, [cacheSeen, connectionElapsed, connectionIssue, error, isOnline, listenerFromCache, listenerHasPendingWrites, pendingWrites, serverReady])

  const syncDetail = useMemo(() => {
    if (!hasSharedBackend) return 'Firebase is not configured; changes stay on this device.'
    if (error) return error
    if (!isOnline) return 'The browser reports that this device is offline.'
    if (connectionIssue) return connectionIssue
    if (connectionPhase === 'auth') return `Step 1 of 2: establishing the anonymous Firebase session · ${connectionElapsed}s.`
    if (connectionPhase === 'restarting') return 'Restarting the Firestore network connection.'
    if (!serverReady) {
      const cachedText = cacheSeen ? ' Last saved choices are shown provisionally.' : ''
      return `Step 2 of 2: requesting authoritative Firestore data · ${connectionElapsed}s.${cachedText}`
    }
    if (pendingWrites > 0 || listenerHasPendingWrites) return 'Saving the latest change to Firebase.'
    if (listenerFromCache) return 'The live connection was interrupted. Firestore is reconnecting.'
    return `Firebase project ${firebaseProjectId} is connected and is the source of truth.`
  }, [cacheSeen, connectionElapsed, connectionIssue, connectionPhase, error, isOnline, listenerFromCache, listenerHasPendingWrites, pendingWrites, serverReady])

  function blockUntilAuthoritative() {
    setConnectionIssue('Firebase has not confirmed the shared board yet. Use Retry now if this does not clear shortly.')
  }

  async function setDecision(eventId, choice) {
    if (hasSharedBackend && !canEdit) {
      blockUntilAuthoritative()
      return
    }

    const currentVotes = votesRef.current
    const currentChoices = groupChoicesRef.current
    const existingVote = currentVotes.find((vote) => vote.user_id === sharedMember.user_id && vote.event_id === eventId)
    const currentlyAttending = currentChoices.some((item) => item.event_id === eventId)

    let nextChoice
    if (choice === 'going') {
      nextChoice = currentlyAttending ? null : 'going'
    } else {
      nextChoice = existingVote?.choice === choice ? null : choice
    }

    const nextVotes = currentVotes.filter((vote) => !(vote.user_id === sharedMember.user_id && vote.event_id === eventId))
    if (nextChoice) {
      nextVotes.push({ trip_id: TRIP_ID, user_id: sharedMember.user_id, event_id: eventId, choice: nextChoice, updated_at: new Date().toISOString() })
    }

    const shouldAttend = nextChoice === 'going'
    const groupRecord = {
      trip_id: TRIP_ID,
      decision_id: 'schedule',
      event_id: eventId,
      updated_by: backendUserId || sharedMember.user_id,
      updated_at: new Date().toISOString(),
    }
    const nextChoices = shouldAttend
      ? [...currentChoices.filter((item) => item.event_id !== eventId), groupRecord]
      : currentChoices.filter((item) => item.event_id !== eventId)

    votesRef.current = nextVotes
    groupChoicesRef.current = nextChoices
    setVotes(nextVotes)
    setGroupChoices(nextChoices)
    cacheSharedData({ votes: nextVotes, groupChoices: nextChoices })

    if (!hasSharedBackend) {
      const stored = loadLocalData()
      stored.votes = nextVotes
      stored.groupChoices = nextChoices
      saveLocalData(stored)
      return
    }

    setPendingWrites((count) => count + 1)
    const voteRef = doc(db, 'trips', TRIP_ID, 'votes', `${sharedMember.user_id}--${eventId}`)
    const choiceRef = doc(db, 'trips', TRIP_ID, 'groupChoices', eventId)

    try {
      const batch = writeBatch(db)
      if (nextChoice) {
        batch.set(voteRef, {
          trip_id: TRIP_ID,
          user_id: sharedMember.user_id,
          event_id: eventId,
          choice: nextChoice,
          updated_by: backendUserId,
          updated_at: serverTimestamp(),
        })
      } else {
        batch.delete(voteRef)
      }
      if (shouldAttend) {
        batch.set(choiceRef, { ...groupRecord, updated_at: serverTimestamp() })
      } else {
        batch.delete(choiceRef)
      }
      await batch.commit()
    } catch (err) {
      votesRef.current = currentVotes
      groupChoicesRef.current = currentChoices
      setVotes(currentVotes)
      setGroupChoices(currentChoices)
      cacheSharedData({ votes: currentVotes, groupChoices: currentChoices })
      setError(err.message || 'Could not save the shared schedule decision.')
    } finally {
      setPendingWrites((count) => Math.max(0, count - 1))
    }
  }

  async function setGroupChoice(decisionId, eventId) {
    if (hasSharedBackend && !canEdit) {
      blockUntilAuthoritative()
      return
    }

    const currentChoices = groupChoicesRef.current
    const clear = currentChoices.some((item) => item.event_id === eventId)
    const record = {
      trip_id: TRIP_ID,
      decision_id: decisionId,
      event_id: eventId,
      updated_by: backendUserId || sharedMember.user_id,
      updated_at: new Date().toISOString(),
    }
    const nextChoices = clear
      ? currentChoices.filter((item) => item.event_id !== eventId)
      : [...currentChoices.filter((item) => item.event_id !== eventId), record]

    groupChoicesRef.current = nextChoices
    setGroupChoices(nextChoices)
    cacheSharedData({ groupChoices: nextChoices })

    if (!hasSharedBackend) {
      const stored = loadLocalData()
      stored.groupChoices = nextChoices
      saveLocalData(stored)
      return
    }

    setPendingWrites((count) => count + 1)
    const choiceRef = doc(db, 'trips', TRIP_ID, 'groupChoices', eventId)
    try {
      if (clear) {
        await deleteDoc(choiceRef)
      } else {
        await setDoc(choiceRef, { ...record, updated_at: serverTimestamp() })
      }
    } catch (err) {
      groupChoicesRef.current = currentChoices
      setGroupChoices(currentChoices)
      cacheSharedData({ groupChoices: currentChoices })
      setError(err.message || 'Could not update the group selection.')
    } finally {
      setPendingWrites((count) => Math.max(0, count - 1))
    }
  }

  async function clearGroupChoices(eventIds = []) {
    if (hasSharedBackend && !canEdit) {
      blockUntilAuthoritative()
      return
    }

    const ids = [...new Set(eventIds)]
    if (!ids.length) return

    const currentChoices = groupChoicesRef.current
    const nextChoices = currentChoices.filter((item) => !ids.includes(item.event_id))
    groupChoicesRef.current = nextChoices
    setGroupChoices(nextChoices)
    cacheSharedData({ groupChoices: nextChoices })

    if (!hasSharedBackend) {
      const stored = loadLocalData()
      stored.groupChoices = nextChoices
      saveLocalData(stored)
      return
    }

    setPendingWrites((count) => count + 1)
    try {
      await Promise.all(ids.map((eventId) => deleteDoc(doc(db, 'trips', TRIP_ID, 'groupChoices', eventId))))
    } catch (err) {
      groupChoicesRef.current = currentChoices
      setGroupChoices(currentChoices)
      cacheSharedData({ groupChoices: currentChoices })
      setError(err.message || 'Could not clear the group selections.')
    } finally {
      setPendingWrites((count) => Math.max(0, count - 1))
    }
  }

  return {
    member: sharedMember,
    members: [],
    votes,
    groupChoices,
    loading: false,
    syncState,
    syncDetail,
    connectionElapsed,
    canEdit,
    error,
    setError,
    retryFirebase,
    setVote: setDecision,
    setDecision,
    setGroupChoice,
    clearGroupChoices,
  }
}
function SyncBadge({ state, elapsed = 0, detail = '' }) {
  const labels = {
    ready: 'Live sync',
    saving: 'Saving',
    cached: 'Cached',
    offline: 'Offline',
    local: 'Device demo',
    error: 'Sync error',
    connecting: 'Connecting',
    retrying: 'Still connecting',
    reconnecting: 'Reconnecting',
    restarting: 'Restarting',
  }
  const icon = ['ready', 'saving', 'connecting', 'retrying', 'reconnecting', 'restarting', 'cached'].includes(state) ? 'wifi' : 'offline'
  const showElapsed = ['connecting', 'retrying'].includes(state) && elapsed > 0
  const label = `${labels[state] || 'Connecting'}${showElapsed ? ` · ${elapsed}s` : ''}`
  return (
    <span className={classNames('sync-badge', state)} title={detail || labels[state] || 'Connecting'} aria-label={detail || label}>
      <Icon name={icon} size={15} />
      <span>{label}</span>
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

function VoteControls({ eventId, member, votes, onVote, compact = false, disabled = false, attending = false, overrideAvailable = false }) {
  const storedChoice = votes.find((vote) => vote.user_id === member?.user_id && vote.event_id === eventId)?.choice
  const selectedChoice = attending ? 'going' : storedChoice
  return (
    <div className={classNames('vote-controls', compact && 'compact')} aria-label="Schedule decision">
      {Object.entries(choiceLabels).map(([choice, label]) => {
        const displayLabel = choice === 'going' && overrideAvailable && !attending ? 'Override & attend' : label
        return (
          <button
            key={choice}
            className={classNames(`vote-${choice}`, selectedChoice === choice && 'selected')}
            onClick={() => onVote(eventId, choice)}
            aria-pressed={selectedChoice === choice}
            disabled={disabled}
            title={disabled ? 'Editing unlocks after Firebase confirms the current shared board.' : undefined}
          >
            {displayLabel}
          </button>
        )
      })}
    </div>
  )
}

function VoteSummary({ eventId, votes, members }) {
  const eventVotes = votes.filter((vote) => vote.event_id === eventId)
  if (!eventVotes.length) return <span className="muted tiny">No decision yet</span>

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
      <span className="summary-pill strong">{counts.going || 0} attend</span>
      <span className="summary-pill">{counts.maybe || 0} maybe</span>
      <span className="summary-pill subdued">{counts.skip || 0} skip</span>
      {wanting.length > 0 && <span className="wanting-names">{wanting.join(', ')}</span>}
    </div>
  )
}

function EventOption({ event, decision, selectedEventIds, selectedGroupEvents, member, members, votes, onVote, onGroupChoice, canEdit }) {
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
        <VoteControls eventId={event.id} member={member} votes={votes} onVote={onVote} compact disabled={!canEdit} />
        <button
          className={classNames('group-pick-button', selected && 'selected', isConflictMuted && 'override')}
          onClick={() => onGroupChoice(decision.id, event.id)}
          disabled={!canEdit}
          title={!canEdit ? 'Editing unlocks after Firebase confirms the current shared board.' : undefined}
        >
          {selected ? 'Clear group pick' : isConflictMuted ? 'Add override' : 'Set group pick'}
        </button>
      </div>
    </article>
  )
}

function DecisionCard({ decision, selectedEventIds, selectedGroupEvents, member, members, votes, onVote, onGroupChoice, canEdit, defaultOpen = false }) {
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
                canEdit={canEdit}
              />
            ))}
        </div>
      )}
    </section>
  )
}

function DecisionsView({ activeDay, member, members, votes, groupChoices, onVote, onGroupChoice, canEdit }) {
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
            canEdit={canEdit}
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

function isNonBlockingWindow(event) {
  return Boolean(event.flexible || event.category === 'Air Show')
}

function staysVisibleDuringConflicts(event) {
  return Boolean(event.flexible || event.category === 'Demonstration' || event.category === 'Air Show')
}

function selectedConflictIdsFor(selectedEvents) {
  const ids = new Set()
  selectedEvents.forEach((event, index) => {
    selectedEvents.slice(index + 1).forEach((other) => {
      if (event.day === other.day && !isNonBlockingWindow(event) && !isNonBlockingWindow(other) && overlaps(event, other)) {
        ids.add(event.id)
        ids.add(other.id)
      }
    })
  })
  return ids
}

function conflictCandidatesFor(dayEvents, selectedEvents) {
  const blockingSelections = selectedEvents.filter((event) => !isNonBlockingWindow(event))
  const selectedIds = new Set(selectedEvents.map((event) => event.id))
  const conflicts = new Set()
  dayEvents.forEach((event) => {
    if (event.pending || selectedIds.has(event.id) || isNonBlockingWindow(event)) return
    if (blockingSelections.some((selected) => selected.id !== event.id && overlaps(event, selected))) conflicts.add(event.id)
  })
  return conflicts
}

function buildTimelineLayout(dayEvents) {
  const timed = dayEvents.filter((event) => !event.pending)
  const featured = timed.filter((event) => isNonBlockingWindow(event))
  const fixed = timed.filter((event) => !isNonBlockingWindow(event))
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

  const featuredLayout = assignLanes(featured)
  const fixedLayout = assignLanes(fixed, featuredLayout.length ? Math.max(...featuredLayout.map((item) => item.lane)) + 1 : 0)
  const layout = [...featuredLayout, ...fixedLayout]
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

function Timeline({ dayEvents, activeDay, member, votes, groupChoices, onDecision, onClearGroupChoices, canEdit }) {
  const [focusedId, setFocusedId] = useState(null)
  const groupPickedIds = useMemo(() => new Set(groupChoices.map((choice) => choice.event_id)), [groupChoices])
  const selectedGroupEvents = useMemo(
    () => dayEvents.filter((event) => groupPickedIds.has(event.id) && !event.pending),
    [dayEvents, groupPickedIds],
  )
  const selectedOverrideIds = useMemo(() => selectedConflictIdsFor(selectedGroupEvents), [selectedGroupEvents])
  const conflictCandidateIds = useMemo(() => conflictCandidatesFor(dayEvents, selectedGroupEvents), [dayEvents, selectedGroupEvents])
  const hiddenConflictIds = useMemo(() => {
    const hidden = new Set()
    conflictCandidateIds.forEach((eventId) => {
      const event = dayEvents.find((item) => item.id === eventId)
      if (event && !staysVisibleDuringConflicts(event)) hidden.add(eventId)
    })
    return hidden
  }, [conflictCandidateIds, dayEvents])
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
          <h2>Timeline and conflict map</h2>
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
            Attend choices are reversible. Clear them to restore the complete timeline. Demonstrations, flexible displays, and air shows remain visible.
          </span>
          <button
            type="button"
            className="timeline-restore-button"
            onClick={() => onClearGroupChoices(selectedGroupEvents.map((event) => event.id))}
            disabled={!canEdit}
            title={!canEdit ? 'Editing unlocks after Firebase confirms the current shared board.' : undefined}
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
                    event.category === 'Air Show' && 'is-featured-airshow',
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
          <VoteControls
            eventId={focused.id}
            member={member}
            votes={votes}
            onVote={onDecision}
            compact
            disabled={!canEdit}
            attending={groupPickedIds.has(focused.id)}
            overrideAvailable={conflictCandidateIds.has(focused.id)}
          />
        </div>
      ) : (
        <div className="timeline-tap-hint">Tap any colored event bar to choose Attend, Maybe, or Skip.</div>
      )}
    </section>
  )
}

function EventCard({ event, member, members, votes, onDecision, groupPickedIds, selectedOverrideIds, conflictCandidateIds, canEdit }) {
  const conflicts = decisionForEvent(event.id)
  const isGroupPick = groupPickedIds.has(event.id)
  const isOverride = selectedOverrideIds.has(event.id)
  const isConflictMuted = conflictCandidateIds.has(event.id) && !isGroupPick && !staysVisibleDuringConflicts(event)
  return (
    <article id={`event-${event.id}`} className={classNames(
      'schedule-event',
      event.anchor && 'anchor-event',
      event.flexible && 'flex-event',
      event.pending && 'pending-event',
      isGroupPick && 'group-picked-event',
      isOverride && 'override-picked-event',
      isConflictMuted && 'conflict-muted-event',
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
          {conflicts.length > 0 && !isNonBlockingWindow(event) && <span className="conflict-tag">Decision point</span>}
          {isGroupPick && <span className="schedule-pick-tag"><Icon name="check" size={11} /> Group pick</span>}
          {isOverride && <span className="schedule-override-tag"><Icon name="alert" size={11} /> Override</span>}
          {isConflictMuted && <span className="schedule-conflict-muted-tag"><Icon name="alert" size={11} /> Conflicts with Attend choice</span>}
        </div>
        <h3>{event.title}</h3>
        <p><Icon name="map" size={15} /> {event.location}</p>
        {event.pending && <p className="pending-note">The screenshot did not include a complete time. Add it when confirmed.</p>}
        {!event.pending && <VoteSummary eventId={event.id} votes={votes} members={members} />}
        {!event.pending && <VoteControls
          eventId={event.id}
          member={member}
          votes={votes}
          onVote={onDecision}
          compact
          disabled={!canEdit}
          attending={isGroupPick}
          overrideAvailable={conflictCandidateIds.has(event.id)}
        />}
      </div>
    </article>
  )
}

function ScheduleView({ activeDay, member, members, votes, groupChoices, onDecision, onClearGroupChoices, canEdit }) {
  const dayEvents = eventsForDay(activeDay)
  const groupPickedIds = useMemo(() => new Set(groupChoices.map((choice) => choice.event_id)), [groupChoices])
  const selectedGroupEvents = useMemo(
    () => dayEvents.filter((event) => groupPickedIds.has(event.id) && !event.pending),
    [dayEvents, groupPickedIds],
  )
  const selectedOverrideIds = useMemo(() => selectedConflictIdsFor(selectedGroupEvents), [selectedGroupEvents])
  const conflictCandidateIds = useMemo(() => conflictCandidatesFor(dayEvents, selectedGroupEvents), [dayEvents, selectedGroupEvents])

  return (
    <main className="page-content">
      <Timeline
        dayEvents={dayEvents}
        activeDay={activeDay}
        member={member}
        votes={votes}
        groupChoices={groupChoices}
        onDecision={onDecision}
        onClearGroupChoices={onClearGroupChoices}
        canEdit={canEdit}
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
            onDecision={onDecision}
            groupPickedIds={groupPickedIds}
            selectedOverrideIds={selectedOverrideIds}
            conflictCandidateIds={conflictCandidateIds}
            canEdit={canEdit}
          />
        ))}
      </div>
    </main>
  )
}


function MapView() {
  const [zoom, setZoom] = useState(() => window.innerWidth <= 720 ? 1.5 : 1)

  function changeZoom(nextZoom) {
    setZoom(Math.min(2.5, Math.max(1, nextZoom)))
  }

  return (
    <main className="page-content map-page">
      <section className="map-card" aria-label="AirVenture visitor map">
        <div className="map-header">
          <div>
            <span className="kicker">Official visitor map</span>
            <h2>AirVenture grounds map</h2>
          </div>
          <div className="map-zoom-controls" aria-label="Map zoom controls">
            <button type="button" onClick={() => changeZoom(zoom - 0.5)} disabled={zoom <= 1} aria-label="Zoom out">−</button>
            <button type="button" className="map-zoom-value" onClick={() => setZoom(1)} aria-label="Reset map zoom">{Math.round(zoom * 100)}%</button>
            <button type="button" onClick={() => changeZoom(zoom + 0.5)} disabled={zoom >= 2.5} aria-label="Zoom in">+</button>
          </div>
        </div>
        <div className="map-viewport">
          <img
            className="map-image"
            src="/airventure-visitors-map-2026.webp"
            alt="Official EAA AirVenture Oshkosh 2026 visitor map showing the grounds, venues, parking, transportation, food, services, and map grid."
            style={{ width: `${zoom * 100}%` }}
            draggable="false"
          />
        </div>
      </section>
    </main>
  )
}

function App() {
  const trip = useTripData()
  const [activeDay, setActiveDay] = useState('sat')
  const [activeTab, setActiveTab] = useState('schedule')
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
      text: 'Open our shared AirVenture schedule. Everyone sees and edits the same board.',
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
        <span>Connecting to the shared schedule…</span>
      </div>
    )
  }

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
          <SyncBadge state={trip.syncState} elapsed={trip.connectionElapsed} detail={trip.syncDetail} />
          <button className="icon-button" onClick={shareTrip} aria-label="Share trip"><Icon name="share" /></button>
        </div>
      </header>

      {trip.error && (
        <div className="error-banner">
          <Icon name="alert" size={18} />
          <span>{trip.error}</span>
          {hasSharedBackend && <button onClick={trip.retryFirebase}>Retry Firebase</button>}
          <button onClick={() => trip.setError('')}>Dismiss</button>
        </div>
      )}

      {hasSharedBackend && !trip.canEdit && !trip.error && (
        <div className={classNames('sync-notice', trip.syncState === 'retrying' && 'retrying')}>
          <Icon name={trip.syncState === 'offline' ? 'offline' : 'wifi'} size={17} />
          <span>
            <strong>{trip.syncState === 'retrying' ? 'Firebase has not responded yet.' : 'Connecting to Firebase.'}</strong>{' '}
            {trip.syncDetail} Editing unlocks automatically after Firebase confirms the server state.
          </span>
          <button className="sync-retry-button" type="button" onClick={trip.retryFirebase}>Retry now</button>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="sticky-day-bar"><DayToggle activeDay={activeDay} onChange={setActiveDay} /></div>
      )}

      {activeTab === 'schedule' ? (
        <ScheduleView
          activeDay={activeDay}
          member={trip.member}
          members={trip.members}
          votes={trip.votes}
          groupChoices={trip.groupChoices}
          onDecision={trip.setDecision}
          onClearGroupChoices={trip.clearGroupChoices}
          canEdit={trip.canEdit}
        />
      ) : (
        <MapView />
      )}

      <nav className="bottom-nav" aria-label="Trip board sections">
        <button
          type="button"
          className={activeTab === 'schedule' ? 'active' : ''}
          onClick={() => setActiveTab('schedule')}
          aria-current={activeTab === 'schedule' ? 'page' : undefined}
        >
          <Icon name="calendar" />
          <span>Schedule</span>
        </button>
        <button
          type="button"
          className={activeTab === 'map' ? 'active' : ''}
          onClick={() => setActiveTab('map')}
          aria-current={activeTab === 'map' ? 'page' : undefined}
        >
          <Icon name="map" />
          <span>Map</span>
        </button>
      </nav>

      {toast && <div className="toast" onAnimationEnd={() => setToast('')}>{toast}</div>}
    </div>
  )
}

export default App
