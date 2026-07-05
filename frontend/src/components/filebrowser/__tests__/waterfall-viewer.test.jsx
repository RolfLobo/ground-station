import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/test-utils.jsx';
import WaterfallViewer from '../waterfall-viewer.jsx';

const renderViewer = () => renderWithProviders(
    <WaterfallViewer
        src="/waterfall.png"
        alt="Recorded waterfall"
        centerFrequency={145_800_000}
        sampleRate={2_400_000}
    />
);

describe('WaterfallViewer drag handling', () => {
    it('cancels native drag events from the rendered waterfall image', () => {
        renderViewer();

        const image = screen.getByAltText('Recorded waterfall');

        expect(fireEvent.dragStart(image)).toBe(false);
    });

    it('prevents the browser default on mouse pointer down inside the viewer', () => {
        const setPointerCapture = vi.fn();
        const hasPointerCapture = vi.fn(() => false);
        const viewer = renderViewer().getByTestId('waterfall-viewer');

        viewer.setPointerCapture = setPointerCapture;
        viewer.hasPointerCapture = hasPointerCapture;

        const pointerDown = new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: 'mouse',
            button: 0,
            clientX: 120,
            clientY: 80,
        });

        viewer.dispatchEvent(pointerDown);

        expect(pointerDown.defaultPrevented).toBe(true);
        expect(setPointerCapture).toHaveBeenCalledWith(1);
    });
});
