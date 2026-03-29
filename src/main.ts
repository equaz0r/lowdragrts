import { Game } from './index';

// Initialize game
const game = new Game();

// Cleanup on page close
window.addEventListener('beforeunload', () => {
    game.dispose();
});

// HMR cleanup — dispose the old Game instance before the module is replaced,
// preventing multiple animate() loops fighting over the same canvas.
if ((module as any).hot) {
    (module as any).hot.dispose(() => {
        game.dispose();
    });
    (module as any).hot.accept();
}
