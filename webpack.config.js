const path = require('path');

module.exports = {
    entry: './src/main.ts',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'public'),
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.(vert|frag|glsl)$/,
                use: 'raw-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.vert', '.frag', '.glsl'],
    },
    devServer: {
        static: {
            directory: path.join(__dirname, 'public'),
        },
        compress: true,
        port: 9000,
    },
    // Native fs-change events (what webpack's watcher uses by default) are
    // unreliable on a OneDrive-synced folder — OneDrive's own sync layer can
    // swallow or delay them, so the dev server silently keeps serving a
    // stale bundle after a source edit with no error and no indication
    // anything's wrong. Polling instead of relying on native events is
    // slower (checks every 1s) but actually reliable here. If edits ever
    // again seem to have "no effect" in the browser, this is the first
    // thing to suspect — see CLAUDE.md's OneDrive gotcha note.
    watchOptions: {
        poll: 1000,
    },
    mode: 'development',
};
