<p align="center">
  <img src="public/logo.png" alt="Articordle logo" />
</p>

Articordle is a daily, Wordle-style guessing game for academic papers. You sign in with your Zotero account, pick a collection from your library, and each day you get a randomly chosen paper from that collection to identify. You read AI-generated clues and try to name the paper in five guesses or fewer.

It is a fun way to review your own reading list and test how well you really remember the papers you have saved.

## How to play

1. Sign in with Zotero (or paste a read-only Zotero API key).
2. Choose a library and a collection to play from.
3. Each day, one paper from that collection becomes the puzzle.
4. You start with the first clue revealed. Guess the paper using the search box, which autocompletes from your collection.
5. Every wrong guess reveals the next clue. Solve it before you run out of guesses.

Get it right and you see a "Congratulations!" screen. Run out of guesses and the answer is revealed. Either way, you can hit "Play again" to get a freshly sampled paper.

## The five clues

Clues are revealed one at a time, from most abstract to most specific:

1. A short summary of the abstract
2. A short summary of the results
3. A short summary of the methods (data, model, or experiment)
4. A short summary of the introduction and discussion
5. The full name of the journal it was published in

Each clue is written so it does not give away the title, the authors, or the journal name (until the journal clue itself), so the game stays fair.

## How it works

Each player's data is kept separate. The app reads your Zotero library using your own access, downloads the chosen paper's PDF, extracts the text, and asks Gemini to write the five clues. Your library is never shared with other players, and the app only ever reads from Zotero, never writes to it.

## Tech stack

- Next.js (App Router) and TypeScript
- Tailwind CSS
- Prisma with PostgreSQL
- Zotero Web API (OAuth 1.0a plus API keys)
- Google Gemini for clue generation
- Deployed on Heroku

## License

See [LICENSE](LICENSE).
