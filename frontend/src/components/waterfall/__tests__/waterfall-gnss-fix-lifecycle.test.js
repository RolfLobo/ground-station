import { describe, expect, it } from 'vitest';
import reducer, { resetGnssFixLifecycle, updateGnssFixLifecycleFromOutput } from '../gnss-slice.jsx';

describe('waterfall gnss fix lifecycle', () => {
    it('accepts backend-authored gnss_fix_status for fix transitions', () => {
        let state = reducer(undefined, { type: '@@INIT' });

        state = reducer(state, updateGnssFixLifecycleFromOutput({
            decoder_type: 'gnss',
            timestamp: 100,
            output: {
                gnss_fix_status: 'FIX',
            },
        }));

        expect(state.gnssFixLifecycle.currentStatus).toBe('FIX');
        expect(state.gnssFixLifecycle.currentFixStartedAtMs).toBe(100_000);
        expect(state.gnssFixLifecycle.lastFixAcquiredAtMs).toBe(100_000);

        state = reducer(state, updateGnssFixLifecycleFromOutput({
            decoder_type: 'gnss',
            timestamp: 106,
            output: {
                gnss_fix_status: 'NO FIX',
            },
        }));

        expect(state.gnssFixLifecycle.currentStatus).toBe('NO FIX');
        expect(state.gnssFixLifecycle.currentFixStartedAtMs).toBeNull();
        expect(state.gnssFixLifecycle.lastFixLostAtMs).toBe(106_000);
        expect(state.gnssFixLifecycle.lastFixDurationMs).toBe(6_000);
    });

    it('resets lifecycle to NO DATA for a new streaming session', () => {
        let state = reducer(undefined, { type: '@@INIT' });
        state = reducer(state, updateGnssFixLifecycleFromOutput({
            decoder_type: 'gnss',
            timestamp: 100,
            output: {
                gnss_fix_status: 'FIX',
            },
        }));

        expect(state.gnssFixLifecycle.currentStatus).toBe('FIX');
        expect(state.gnssFixLifecycle.currentFixStartedAtMs).toBe(100_000);

        state = reducer(state, resetGnssFixLifecycle());
        expect(state.gnssFixLifecycle).toEqual({
            currentStatus: 'NO DATA',
            currentFixStartedAtMs: null,
            lastFixAcquiredAtMs: null,
            lastFixLostAtMs: null,
            lastFixDurationMs: null,
            lastSignalAtMs: null,
        });
    });
});
