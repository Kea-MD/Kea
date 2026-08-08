import { act, fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DocumentTabs } from '../../src/editor/DocumentTabs'
import type { DocumentSnapshot } from '../../src/core/contracts/document'

const documents: DocumentSnapshot[] = Array.from({ length: 8 }, (_, index) => ({
  id: `document-${index}`,
  path: `/workspace/document-${index}.md`,
  name: `document-${index}.md`,
  content: '',
  savedContent: '',
  isDirty: false,
}))

describe('React document tabs', () => {
  it('adds extra leading space for the new-tab button when the sidebar is closed', () => {
    const { container } = render(
      <DocumentTabs
        documents={[]}
        activeDocumentId={null}
        hasTrafficLightsInset={false}
        sidebarOpen={false}
        onSelect={() => {}}
        onClose={() => {}}
        onReorder={() => {}}
        onNew={() => {}}
      />,
    )

    expect(container.querySelector('.react-tabs-list')?.className).toContain('pl-[25px]')
  })

  it('ramps both edge fades with scroll distance and removes them at the boundaries', () => {
    const { container } = render(
      <DocumentTabs
        documents={documents}
        activeDocumentId={documents[0].id}
        hasTrafficLightsInset={false}
        sidebarOpen
        onSelect={() => {}}
        onClose={() => {}}
        onReorder={() => {}}
        onNew={() => {}}
      />,
    )
    const scroller = container.querySelector('.react-tabs-scroll') as HTMLDivElement
    const mask = scroller.parentElement as HTMLDivElement

    Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: 500 })
    Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 200 })

    scroller.scrollLeft = 36
    act(() => fireEvent.scroll(scroller))
    expect(mask.style.getPropertyValue('--tabs-mask-left')).toBe('30px')
    expect(mask.style.getPropertyValue('--tabs-mask-right')).toBe('60px')

    scroller.scrollLeft = 150
    act(() => fireEvent.scroll(scroller))
    expect(mask.style.getPropertyValue('--tabs-mask-left')).toBe('60px')
    expect(mask.style.getPropertyValue('--tabs-mask-right')).toBe('60px')

    scroller.scrollLeft = 300
    act(() => fireEvent.scroll(scroller))
    expect(mask.style.getPropertyValue('--tabs-mask-left')).toBe('60px')
    expect(mask.style.getPropertyValue('--tabs-mask-right')).toBe('0px')
  })

  it('commits a pointer drag as a document reorder without selecting the dropped tab', () => {
    const onSelect = vi.fn()
    const onReorder = vi.fn()
    const { container } = render(
      <DocumentTabs
        documents={documents.slice(0, 3)}
        activeDocumentId={documents[0].id}
        hasTrafficLightsInset={false}
        sidebarOpen
        onSelect={onSelect}
        onClose={() => {}}
        onReorder={onReorder}
        onNew={() => {}}
      />,
    )

    const tabs = Array.from(container.querySelectorAll<HTMLElement>('[data-tab-id]'))
    tabs.forEach((tab, index) => {
      Object.defineProperty(tab, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: index * 107, right: index * 107 + 100, top: 0, bottom: 26, width: 100, height: 26 }),
      })
    })

    fireEvent.pointerDown(tabs[0], { button: 0, clientX: 12, clientY: 12 })
    act(() => fireEvent.pointerMove(tabs[0], { clientX: 330, clientY: 12 }))
    expect(container.querySelector('.react-tab-drag-overlay')?.className).not.toContain('is-active')
    expect(container.querySelector('.react-tab-drop-indicator')).toBeNull()
    expect(tabs[1].style.transform).toContain('translate3d(-107px')
    expect(tabs[2].style.transform).toContain('translate3d(-107px')
    act(() => fireEvent.pointerUp(tabs[0], { clientX: 330, clientY: 12 }))

    expect(onReorder).toHaveBeenCalledWith(0, 2)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('waits for the dragged tab edge before shifting tabs left', () => {
    const { container } = render(
      <DocumentTabs
        documents={documents.slice(0, 3)}
        activeDocumentId={documents[2].id}
        hasTrafficLightsInset={false}
        sidebarOpen
        onSelect={() => {}}
        onClose={() => {}}
        onReorder={() => {}}
        onNew={() => {}}
      />,
    )

    const tabs = Array.from(container.querySelectorAll<HTMLElement>('[data-tab-id]'))
    tabs.forEach((tab, index) => {
      Object.defineProperty(tab, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: index * 107, right: index * 107 + 100, top: 0, bottom: 26, width: 100, height: 26 }),
      })
    })

    fireEvent.pointerDown(tabs[2], { button: 0, clientX: 226, clientY: 12 })
    act(() => fireEvent.pointerMove(tabs[2], { clientX: 180, clientY: 12 }))
    expect(tabs[1].style.transform).toBe('')

    act(() => fireEvent.pointerMove(tabs[2], { clientX: 50, clientY: 12 }))
    expect(tabs[1].style.transform).toContain('translate3d(107px')
    act(() => fireEvent.pointerUp(tabs[2], { clientX: 50, clientY: 12 }))
  })
})
