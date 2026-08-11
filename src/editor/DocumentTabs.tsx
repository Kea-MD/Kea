import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react'
import type { DocumentSnapshot } from '../core/contracts/document'
import { ContextMenu } from '../shared/ContextMenu'
import { formatShortcutForDisplay } from '../modules/settings/shortcuts/shortcutRegistry'
import './DocumentTabs.css'

const TAB_FADE_MAX = 60
const TAB_FADE_RAMP = 72
const TAB_GAP = 7
const DRAG_THRESHOLD = 4
const DRAG_FOLLOW_LERP = 0.28

function getTabFade(distanceFromEdge: number): number {
  return Math.min(TAB_FADE_MAX, Math.max(0, (distanceFromEdge / TAB_FADE_RAMP) * TAB_FADE_MAX))
}

function nearestInsertionIndex(clientX: number, tabRects: Array<Pick<DOMRect, 'left' | 'right'>>): number {
  if (tabRects.length === 0) return 0

  let insertionIndex = 0
  let closestDistance = Math.abs(clientX - tabRects[0].left)
  for (let index = 1; index < tabRects.length; index += 1) {
    const boundary = (tabRects[index - 1].right + tabRects[index].left) / 2
    const distance = Math.abs(clientX - boundary)
    if (distance < closestDistance) {
      closestDistance = distance
      insertionIndex = index
    }
  }

  if (Math.abs(clientX - tabRects[tabRects.length - 1].right) < closestDistance) {
    insertionIndex = tabRects.length
  }
  return insertionIndex
}

interface DragPresentation {
  tabId: string
  left: number
  top: number
  width: number
  translateX: number
  dropIndex: number | null
}

interface TabDropTarget {
  left: number
  right: number
}

interface DragSession extends DragPresentation {
  startX: number
  startY: number
  pointerOffsetX: number
  targetTranslateX: number
  moved: boolean
  dropTargets: TabDropTarget[]
}

export interface DocumentTabsProps {
  documents: DocumentSnapshot[]
  activeDocumentId: string | null
  hasTrafficLightsInset: boolean
  sidebarOpen: boolean
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onNew: () => void
  onSave?: (id: string) => void | Promise<unknown>
  onSaveAs?: (id: string) => void | Promise<unknown>
  onCopyPath?: (path: string) => void | Promise<void>
  onReveal?: (path: string) => void | Promise<void>
  onCloseOthers?: (id: string) => void | Promise<void>
  onCloseToRight?: (id: string) => void | Promise<void>
  onCloseAll?: () => void | Promise<void>
  shortcuts?: Record<string, string>
}

export function DocumentTabs({ documents, activeDocumentId, hasTrafficLightsInset, sidebarOpen, onSelect, onClose, onReorder, onNew, onSave, onSaveAs, onCopyPath, onReveal, onCloseOthers, onCloseToRight, onCloseAll, shortcuts = {} }: DocumentTabsProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const tabsListRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragSession | null>(null)
  const followFrameRef = useRef<number | null>(null)
  const suppressNextClickRef = useRef(false)
  const pointerMoveRef = useRef<(event: globalThis.PointerEvent) => void>(() => {})
  const pointerUpRef = useRef<(event: globalThis.PointerEvent) => void>(() => {})
  const [fade, setFade] = useState({ left: 0, right: 0 })
  const [dragPresentation, setDragPresentation] = useState<DragPresentation | null>(null)
  const [menu, setMenu] = useState<{ document: DocumentSnapshot; x: number; y: number } | null>(null)
  const shortcut = (id: string): string | undefined => {
    const binding = shortcuts[id]
    if (!binding) return undefined
    const formatted = formatShortcutForDisplay(binding)
    return formatted === 'Unassigned' ? undefined : formatted
  }

  const getTabElements = (): HTMLElement[] => Array.from(tabsListRef.current?.querySelectorAll<HTMLElement>('[data-tab-id]') ?? [])

  const stopFollowLoop = () => {
    if (followFrameRef.current === null) return
    if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(followFrameRef.current)
    else window.clearTimeout(followFrameRef.current)
    followFrameRef.current = null
  }

  const startFollowLoop = () => {
    stopFollowLoop()
    const follow = () => {
      const drag = dragRef.current
      if (!drag?.moved) {
        followFrameRef.current = null
        return
      }

      const distance = drag.targetTranslateX - drag.translateX
      drag.translateX = Math.abs(distance) < 0.35
        ? drag.targetTranslateX
        : drag.translateX + distance * DRAG_FOLLOW_LERP
      setDragPresentation(current => current ? { ...current, translateX: drag.translateX } : current)
      followFrameRef.current = typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame(follow)
        : window.setTimeout(follow, 16)
    }

    followFrameRef.current = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame(follow)
      : window.setTimeout(follow, 16)
  }

  const getContainerRect = (): DOMRect | null => {
    const rect = scrollerRef.current?.getBoundingClientRect()
    return rect && rect.width > 0 ? rect : null
  }

  const getClampedTranslate = (clientX: number, drag: DragSession): number => {
    const containerRect = getContainerRect()
    const rawTranslate = clientX - drag.startX
    if (!containerRect || drag.width <= 0) return rawTranslate

    const minTranslate = containerRect.left - drag.left
    const maxTranslate = containerRect.right - drag.left - drag.width
    return Math.min(maxTranslate, Math.max(minTranslate, rawTranslate))
  }

  const updateDropTarget = (clientX: number) => {
    const drag = dragRef.current
    if (!drag?.moved) return

    const fromIndex = documents.findIndex(document => document.id === drag.tabId)
    const tabRects = drag.dropTargets
    const hasMeasuredGeometry = tabRects.some(rect => rect.left !== rect.right)
    if (fromIndex < 0 || !hasMeasuredGeometry) {
      drag.dropIndex = null
      setDragPresentation(current => current ? { ...current, dropIndex: null } : current)
      return
    }

    const insertionIndex = nearestInsertionIndex(clientX, tabRects)
    const dropIndex = Math.max(0, Math.min(documents.length - 1, insertionIndex > fromIndex ? insertionIndex - 1 : insertionIndex))
    if (dropIndex === fromIndex) {
      drag.dropIndex = null
      setDragPresentation(current => current ? { ...current, dropIndex: null } : current)
      return
    }
    drag.dropIndex = dropIndex
    setDragPresentation(current => current ? { ...current, dropIndex } : current)
  }

  const clearDrag = () => {
    stopFollowLoop()
    dragRef.current = null
    setDragPresentation(null)
  }

  const handlePointerMove = (event: globalThis.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return

    if (!drag.moved) {
      const distanceX = Math.abs(event.clientX - drag.startX)
      const distanceY = Math.abs(event.clientY - drag.startY)
      if (distanceX < DRAG_THRESHOLD && distanceY < DRAG_THRESHOLD) return
      drag.moved = true
      drag.targetTranslateX = getClampedTranslate(event.clientX, drag)
      drag.translateX = drag.targetTranslateX
      setDragPresentation({ ...drag })
      startFollowLoop()
    }

    event.preventDefault()
    drag.targetTranslateX = getClampedTranslate(event.clientX, drag)
    const isMovingRight = event.clientX > drag.startX
    const dropProbeX = isMovingRight
      ? event.clientX + (drag.width - drag.pointerOffsetX)
      : event.clientX - drag.pointerOffsetX
    updateDropTarget(dropProbeX)
  }

  const handlePointerUp = (event: globalThis.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return

    if (drag.moved) {
      event.preventDefault()
      const fromIndex = documents.findIndex(document => document.id === drag.tabId)
      if (fromIndex >= 0 && drag.dropIndex !== null && fromIndex !== drag.dropIndex) onReorder(fromIndex, drag.dropIndex)
      suppressNextClickRef.current = true
      window.setTimeout(() => { suppressNextClickRef.current = false }, 0)
    }
    clearDrag()
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>, id: string) => {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button'))) return
    const rect = event.currentTarget.getBoundingClientRect()
    const dropTargets = getTabElements().map(element => {
      const tabRect = element.getBoundingClientRect()
      return { left: tabRect.left, right: tabRect.right }
    })
    dragRef.current = {
      tabId: id,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      translateX: 0,
      targetTranslateX: 0,
      startX: event.clientX,
      startY: event.clientY,
      pointerOffsetX: event.clientX - rect.left,
      moved: false,
      dropTargets,
      dropIndex: null,
    }
    event.preventDefault()
  }

  pointerMoveRef.current = handlePointerMove
  pointerUpRef.current = handlePointerUp

  useEffect(() => {
    const handleMove = (event: globalThis.PointerEvent) => pointerMoveRef.current(event)
    const handleUp = (event: globalThis.PointerEvent) => pointerUpRef.current(event)
    document.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerup', handleUp)
    document.addEventListener('pointercancel', handleUp)
    return () => {
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerup', handleUp)
      document.removeEventListener('pointercancel', handleUp)
      stopFollowLoop()
    }
  }, [])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const updateOverflow = () => {
      const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth
      setFade(maxScrollLeft <= 1
        ? { left: 0, right: 0 }
        : {
            left: getTabFade(scroller.scrollLeft),
            right: getTabFade(maxScrollLeft - scroller.scrollLeft),
          })
    }

    updateOverflow()
    scroller.addEventListener('scroll', updateOverflow)
    window.addEventListener('resize', updateOverflow)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateOverflow)
    observer?.observe(scroller)
    if (scroller.firstElementChild) observer?.observe(scroller.firstElementChild)
    return () => {
      scroller.removeEventListener('scroll', updateOverflow)
      window.removeEventListener('resize', updateOverflow)
      observer?.disconnect()
    }
  }, [documents.length])

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const scroller = scrollerRef.current
    if (!scroller || Math.abs(event.deltaX) > 0.01 || event.deltaY === 0 || scroller.scrollWidth <= scroller.clientWidth) return
    const previousScrollLeft = scroller.scrollLeft
    scroller.scrollLeft += event.deltaY
    if (scroller.scrollLeft !== previousScrollLeft) event.preventDefault()
  }

  const showTrafficLightsSafeArea = !sidebarOpen && hasTrafficLightsInset
  const maskStyle = {
    '--tabs-mask-left': `${fade.left}px`,
    '--tabs-mask-right': `${fade.right}px`,
  } as CSSProperties
  const activeDocumentIsFirst = documents[0]?.id === activeDocumentId
  const emptyTabsPaddingClass = sidebarOpen ? 'pl-[15px] pr-[20px]' : 'pl-[25px] pr-[20px]'
  const tabListPaddingClass = activeDocumentIsFirst
    ? 'pl-[26px] pr-[20px]'
    : documents.length === 0 ? emptyTabsPaddingClass : 'px-[26px]'
  const draggedDocument = documents.find(document => document.id === dragPresentation?.tabId)

  const getTabTransform = (index: number): string | undefined => {
    if (!dragPresentation || dragPresentation.dropIndex === null) return undefined
    const fromIndex = documents.findIndex(document => document.id === dragPresentation.tabId)
    const toIndex = dragPresentation.dropIndex
    const shift = dragPresentation.width + TAB_GAP
    if (fromIndex < toIndex && index > fromIndex && index <= toIndex) return `translate3d(${-shift}px, 0, 0)`
    if (fromIndex > toIndex && index >= toIndex && index < fromIndex) return `translate3d(${shift}px, 0, 0)`
    return undefined
  }

  return (
    <div className="relative z-[2] flex h-10 min-w-0 items-start overflow-hidden pt-[7px]" role="tablist" aria-label="Open documents">
      {showTrafficLightsSafeArea && <div className="react-tabs-traffic-lights-safe-area" aria-hidden="true" />}
      <div className="flex min-w-0 flex-1 items-start pr-4 pl-0 select-none">
        <div className="relative min-w-0 flex-1" style={maskStyle}>
          <div ref={scrollerRef} className="react-tabs-scroll flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none]" onWheel={handleWheel}>
            <div ref={tabsListRef} className={`react-tabs-list relative flex w-max gap-[7px] ${tabListPaddingClass}`}>
              {documents.map((document, index) => {
                const active = document.id === activeDocumentId
                const isDragged = document.id === dragPresentation?.tabId
                const transform = getTabTransform(index)
                return (
                  <div
                    key={document.id}
                    className={`react-tab relative flex h-[26px] max-w-[180px] cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-[13px] border-0 bg-[var(--react-toolbar-background)] px-[5px] py-[5px] pl-[15px] text-[13px] text-[var(--react-tab-text)]${active ? ' is-active h-[33px] rounded-[13px_13px_0_0] font-semibold text-[var(--react-tab-active-text)]' : ''}${document.isDirty ? ' is-dirty' : ''}${isDragged ? ' is-drag-ghost' : ''}`}
                    style={transform ? { transform } : undefined}
                    role="tab"
                    aria-selected={active}
                    aria-grabbed={isDragged}
                    tabIndex={active ? 0 : -1}
                    data-tab-id={document.id}
                    onContextMenu={event => { event.preventDefault(); setMenu({ document, x: event.clientX, y: event.clientY }) }}
                    onPointerDown={event => handlePointerDown(event, document.id)}
                    onClick={() => {
                      if (suppressNextClickRef.current) {
                        suppressNextClickRef.current = false
                        return
                      }
                      onSelect(document.id)
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onSelect(document.id)
                      }
                    }}
                  >
                    {active && (
                      <>
                        <svg className="react-tab-corner react-tab-corner-left" viewBox="0 0 26 26" aria-hidden="true"><path d="M26 0 Q26 26 0 26" /></svg>
                        <svg className="react-tab-corner react-tab-corner-right" viewBox="0 0 26 26" aria-hidden="true"><path d="M0 0 Q0 26 26 26" /></svg>
                      </>
                    )}
                    <span className="min-w-0 overflow-hidden text-ellipsis font-medium">{document.name}</span>
                    {document.isDirty && <span className="m-1 h-2 w-2 flex-none rounded-full bg-[rgb(var(--react-brand-rgb))] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" title="Unsaved changes" />}
                    <button type="button" className="flex h-4 w-4 flex-none items-center justify-center rounded-[3px] border-0 bg-transparent p-0 text-inherit opacity-0 hover:bg-[rgba(37,39,45,0.1)] hover:opacity-100 dark:hover:bg-[rgba(238,238,246,0.11)]" aria-label={`Close ${document.name}`} title="Close" onClick={event => { event.stopPropagation(); onClose(document.id) }}><i className="pi pi-times text-[10px]" aria-hidden="true" /></button>
                  </div>
                )
              })}
              <button type="button" className="react-new-tab inline-flex h-[26px] w-[26px] flex-none cursor-pointer items-center justify-center rounded-[13px] border-0 bg-[var(--react-toolbar-background)] p-0 text-[var(--react-tab-text)] hover:bg-[var(--react-light-300)] hover:text-[var(--react-dark-700)] dark:hover:bg-[rgba(238,238,246,0.11)] dark:hover:text-[var(--react-light-50)]" aria-label="New document" title="New document" onClick={onNew}><i className="pi pi-plus text-[10px]" aria-hidden="true" /></button>
            </div>
          </div>
        </div>
      </div>
      {draggedDocument && dragPresentation && <div className={`react-tab react-tab-drag-overlay${draggedDocument.isDirty ? ' is-dirty' : ''}`} style={{ left: dragPresentation.left, top: dragPresentation.top, width: dragPresentation.width, transform: `translate3d(${dragPresentation.translateX}px, 0, 0)` }} aria-hidden="true">
        <span className="min-w-0 overflow-hidden text-ellipsis font-medium">{draggedDocument.name}</span>
        {draggedDocument.isDirty && <span className="m-1 h-2 w-2 flex-none rounded-full bg-[rgb(var(--react-brand-rgb))]" title="Unsaved changes" />}
        <button type="button" tabIndex={-1} aria-hidden="true"><i className="pi pi-times text-[10px]" aria-hidden="true" /></button>
      </div>}
      {menu && <ContextMenu
        x={menu.x}
        y={menu.y}
        label={`Actions for ${menu.document.name}`}
        onClose={() => setMenu(null)}
        items={[
          { id: 'save', label: 'Save', icon: 'pi-save', shortcut: shortcut('save'), disabled: !menu.document.isDirty || !onSave, onSelect: () => onSave?.(menu.document.id) },
          { id: 'save-as', label: 'Save As…', icon: 'pi-file-export', shortcut: shortcut('save_as'), disabled: !onSaveAs, onSelect: () => onSaveAs?.(menu.document.id) },
          { type: 'separator' },
          { id: 'copy-path', label: 'Copy Path', icon: 'pi-copy', disabled: !menu.document.path || !onCopyPath, onSelect: () => { if (menu.document.path) return onCopyPath?.(menu.document.path) } },
          { id: 'reveal', label: 'Reveal in Finder', icon: 'pi-search', disabled: !menu.document.path || !onReveal, onSelect: () => { if (menu.document.path) return onReveal?.(menu.document.path) } },
          { type: 'separator' },
          { id: 'close', label: 'Close', icon: 'pi-times', shortcut: shortcut('close_tab'), onSelect: () => onClose(menu.document.id) },
          { id: 'close-others', label: 'Close Others', icon: 'pi-minus', disabled: documents.length < 2 || !onCloseOthers, onSelect: () => onCloseOthers?.(menu.document.id) },
          { id: 'close-right', label: 'Close Tabs to the Right', icon: 'pi-arrow-right', disabled: documents.findIndex(item => item.id === menu.document.id) === documents.length - 1 || !onCloseToRight, onSelect: () => onCloseToRight?.(menu.document.id) },
          { id: 'close-all', label: 'Close All Tabs', icon: 'pi-times-circle', onSelect: () => onCloseAll ? onCloseAll() : documents.forEach(item => onClose(item.id)) },
        ]}
      />}
    </div>
  )
}
