import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { createInitialSession, serializeSession } from '../sessionPersistence';

jest.mock('../nativeTheme', () => ({ applyNativeTheme: () => Promise.resolve() }));

describe('theme UI', () => {
  beforeEach(() => {
    const query = {
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
    window.matchMedia = jest.fn(() => query);
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('selects Dark and keeps populated game history in the dark theme', async () => {
    const session = createInitialSession();
    session.players[0].name = 'Alex';
    session.gameHistory = [{
      gameNumber: 1,
      courts: 1,
      courtModes: ['2v2'],
      playing: [{ ...session.players[0] }],
      sittingOut: [],
      teams: [],
      createdAt: '2026-08-02T00:00:00.000Z'
    }];
    localStorage.setItem('volleyball-session', serializeSession(session));

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Use dark theme' }));

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    expect(screen.getByText('Game History').closest('.game-history-panel')).not.toBeNull();
    expect(screen.getByText('Game 1').closest('.history-game-card')).not.toBeNull();
  });
});
