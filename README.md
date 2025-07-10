 # livelyrics

An app that listens to music around you, identifies the song, and displays synchronized lyrics in real-time.

## Features
* Audio Recognition: Uses AudD API to identify songs playing in your environment
* Synchronized Lyrics: Displays lyrics that scroll automatically in time with the music
* Dynamic Highlighting: Current lyrics are highlighted and centered on screen
* Lyrics Caching: Stores previously fetched lyrics for offline use
* Multiple Providers: Uses the syncedlyrics Python package to fetch lyrics from various sources

## Getting Started

Prerequisites
* Node.js and npm
* Python 3.6+
* Expo CLI

Note: If you encounter missing package errors during setup, install them as needed using npm install <package> or pip install <package>.

Installation
1. Clone the repository
   ```bash
   git clone https://github.com/Keviny2007/livelyrics.git
   cd livelyrics
2. Install JavaScript dependencies
   ```bash
   npm install
3. Install Python dependencies
   ```bash
   pip install syncedlyrics
4. Set up environment variables
   ```bash
   cp .env.example .env
   
Then edit the .env file to add your AudD API key and set your API server URL.

5. Start the API server in one terminal
   ```bash
   node server.js
6. Start the Expo app in another terminal
   ```bash
   npx expo start

## Usage

1. Launch the app on your device using Expo Go
2. Tap "Start Listening" when music is playing
3. Wait a few seconds for the app to identify the song
4. Once identified, synchronized lyrics will appear automatically
5. The current line will be highlighted and the display will scroll as the song progresses

## How It Works

1. The app records a short audio sample using the device microphone
2. The sample is sent to the AudD API for song identification
3. When a song is recognized, the app receives the title, artist, and current timestamp
4. A search query is constructed and sent to the lyrics API server
5. The server uses the syncedlyrics Python package to fetch LRC-format lyrics
6. The app parses, displays, and highlights the lyrics based on the song's timestamp

## Architecture

* **Frontend**: React Native / Expo app
* **Backend**: Express.js server
* **Lyrics Engine**: syncedlyrics Python package
* **APIs**: AudD for song recognition

## Lyric Providers

The app uses the syncedlyrics package which fetches lyrics from:

* Musixmatch
* LRCLib
* NetEase
* Megalobiz
* Genius

## Troubleshooting

* **Network Errors**: Make sure your API_SERVER_URL is correctly set to your local IP when testing on a physical device
* **No Lyrics Found**: Some songs might not have synchronized lyrics available in the supported databases
* **Audio Recording Issues**: Ensure microphone permissions are granted to the app

## Contributing

Feel free to submit a PR if you find any issues or things that can be improved upon!

## Licensing

The `syncedlyrics/` folder in this repository is based on code from [moehmeni's repo](https://github.com/moehmeni/syncedlyrics), and is licensed under the MIT License.  
See `syncedlyrics/LICENSE` for details.
