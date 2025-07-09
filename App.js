import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Audio } from 'expo-av';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { AUDD_API_KEY, API_SERVER_URL } from '@env';

export default function App() {
  const [song, setSong] = useState(null);
  const [recording, setRecording] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lyrics, setLyrics] = useState([]);
  const [isDisplayingLyrics, setIsDisplayingLyrics] = useState(false);
  const [isLyricsDirectoryReady, setIsLyricsDirectoryReady] = useState(false);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
  const [lyricTimer, setLyricTimer] = useState(null);
  const [currentTimecode, setCurrentTimecode] = useState(null);
  const scrollViewRef = useRef(null);
  const RECORDING_DURATION = 8000; // 8 seconds of listening time

  // Start recording and listening for music
  const startRecording = async () => {
    try {
      // Reset previous state
      setSong(null);
      setLyrics([]);
      setIsDisplayingLyrics(false);
      setIsListening(true);
      
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        alert('Permission to access microphone is required!');
        setIsListening(false);
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HighQuality
      );

      setRecording(recording);
      
      // Set timeout to stop recording after RECORDING_DURATION
      setTimeout(() => {
        stopRecording(recording);
      }, RECORDING_DURATION);
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setIsListening(false);
    }
  };

  // Stop recording and identify the song
  const stopRecording = async (recordingInstance) => {
    try {
      const rec = recordingInstance || recording;
      if (!rec) return;
      
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      setIsLoading(true);

      const formData = new FormData();
      formData.append('file', {
        uri,
        name: 'recording.wav',
        type: 'audio/wav',
      });
      formData.append('api_token', AUDD_API_KEY);
      formData.append('return', 'timecode,apple_music,spotify');

      const response = await axios.post('https://api.audd.io/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      if (response.data?.result) {
        setSong(response.data.result);
        
        // Generate search query from song info
        const title = response.data.result.title || '';
        const artist = response.data.result.artist || '';
        const searchQuery = `${title} ${artist}`.trim().toLowerCase();
        
        console.log('Search query for local lyrics:', searchQuery);
        
        // Try to find and load local lyrics file
        try {
          await loadLocalLyrics(searchQuery);
          
          // Start dynamic lyrics display with the timecode from the API
          if (response.data.result.timecode) {
            const timecodeSeconds = timeToSeconds(response.data.result.timecode);
            console.log(`Starting lyrics display at time position: ${timecodeSeconds}s`);
            startLyricsDisplay(timecodeSeconds);
          }
        } catch (err) {
          console.error('Error loading local lyrics:', err);
          setLyrics([]);
          setIsDisplayingLyrics(false);
        }
      } else {
        setSong({ title: 'Not recognized', artist: '' });
        setLyrics([]);
        setIsDisplayingLyrics(false);
      }

      // Reset states
      setRecording(null);
      setIsListening(false);
      setIsLoading(false);
    } catch (err) {
      console.error('Error stopping recording:', err);
      setSong({ title: 'Error identifying song', artist: '' });
      setRecording(null);
      setIsListening(false);
      setIsLoading(false);
    }
  };

  // Update the loadLocalLyrics function to use syncedlyrics for dynamic fetching
  const loadLocalLyrics = async (searchQuery) => {
    try {
      if (!isLyricsDirectoryReady) {
        console.log('Lyrics directory not ready yet');
        await setupLyricsDirectory();
      }
      
      console.log('Fetching lyrics dynamically for:', searchQuery);
      
      // Check if we have already cached this query
      const resultsDir = `${FileSystem.documentDirectory}results/`;
      const safeFileName = `${searchQuery.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.lrc`;
      const cachedLyricsPath = `${resultsDir}${safeFileName}`;
      
      try {
        // Check if we already have cached lyrics
        const cachedFileInfo = await FileSystem.getInfoAsync(cachedLyricsPath);
        
        if (cachedFileInfo.exists) {
          console.log('Using cached lyrics file:', safeFileName);
          const cachedContents = await FileSystem.readAsStringAsync(cachedLyricsPath);
          processAndDisplayLyrics(cachedContents);
          return;
        }
        
        // Fetch from the syncedlyrics API server
        console.log('No cached lyrics found, fetching from API...');
        const response = await axios.post(`${API_SERVER_URL}/fetch-lyrics`, {
          searchQuery
        });
        
        if (response.data.error) {
          console.error('API error:', response.data.error);
          setLyrics([{ words: `No lyrics found for: ${searchQuery}` }]);
          setIsDisplayingLyrics(true);
          return;
        }
        
        if (response.data.lyrics) {
          // Save the fetched lyrics to cache
          await FileSystem.writeAsStringAsync(cachedLyricsPath, response.data.lyrics);
          console.log(`Saved new lyrics file: ${safeFileName}`);
          
          // Process and display the lyrics
          processAndDisplayLyrics(response.data.lyrics);
        } else {
          setLyrics([{ words: `No lyrics found for: ${searchQuery}` }]);
          setIsDisplayingLyrics(true);
        }
        
      } catch (err) {
        console.error('Error fetching lyrics from API:', err);
        setLyrics([{ words: `Error fetching lyrics for: ${searchQuery}` }]);
        setIsDisplayingLyrics(true);
      }
    } catch (err) {
      console.error('Error in loadLocalLyrics:', err);
      setLyrics([{ words: "Error loading lyrics" }]);
      setIsDisplayingLyrics(true);
    }
  };

  // Helper function to process and display lyrics
  const processAndDisplayLyrics = (lyricsContent) => {
    // Process timestamped lyrics (LRC format)
    const timestampedLyrics = lyricsContent
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        // Extract timestamp if available
        const timestampMatch = line.match(/^\[(\d{2}:\d{2}(?:[:.]\d+)?)\]/);
        const timestamp = timestampMatch ? timestampMatch[1] : null;
        const text = timestampMatch ? line.substring(timestampMatch[0].length).trim() : line.trim();
        
        return {
          words: text,
          timestamp: timestamp
        };
      });
    
    if (timestampedLyrics.length > 0) {
      setLyrics(timestampedLyrics);
      setIsDisplayingLyrics(true);
    } else {
      setLyrics([{ words: "No lyrics content found" }]);
      setIsDisplayingLyrics(true);
    }
  };

  // Setup lyrics directory on app startup
  useEffect(() => {
    setupLyricsDirectory();
  }, []);

  const setupLyricsDirectory = async () => {
    try {
      const resultsDir = `${FileSystem.documentDirectory}results/`;
      const dirInfo = await FileSystem.getInfoAsync(resultsDir);
      
      if (!dirInfo.exists) {
        console.log("Creating results directory...");
        await FileSystem.makeDirectoryAsync(resultsDir, { intermediates: true });
      }
      
      // List files in directory
      const files = await FileSystem.readDirectoryAsync(resultsDir);
      console.log('Files in results directory:', files);
      
      setIsLyricsDirectoryReady(true);
    } catch (error) {
      console.error("Error setting up lyrics directory:", error);
    }
  };

  // Convert timecode to seconds
  const timeToSeconds = (timeString) => {
    if (!timeString) return 0;
    const parts = timeString.split(':');
    if (parts.length === 2) {
      // Format: MM:SS
      return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
    } else if (parts.length === 3) {
      // Format: HH:MM:SS
      return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
    }
    return 0;
  };

  const startLyricsDisplay = (startTimeSeconds) => {
    // Clear any existing timer
    if (lyricTimer) {
      clearInterval(lyricTimer);
      setLyricTimer(null);
    }

    // Calculate initial position
    const initialIndex = findInitialLyricIndex(startTimeSeconds);
    
    // Create a reference point that won't change during playback
    const initialTime = Date.now();
    const initialOffset = startTimeSeconds;
    
    // Set initial states
    setCurrentLyricIndex(initialIndex);
    setCurrentTimecode(formatTimecode(startTimeSeconds));
    
    // Use a self-contained time reference that doesn't depend on state
    const timer = setInterval(() => {
      // Calculate elapsed time since timer started
      const elapsed = (Date.now() - initialTime) / 1000;
      
      // Current position is the initial offset plus elapsed time
      const currentTimeSeconds = initialOffset + elapsed;
      
      // Update the displayed timecode
      setCurrentTimecode(formatTimecode(currentTimeSeconds));
      
      // Find the current lyric based on timestamp
      setCurrentLyricIndex(prev => {
        const nextIndex = findCurrentLyricIndex(currentTimeSeconds);
        
        // Only scroll if the index actually changed
        if (nextIndex !== prev && nextIndex >= 0 && scrollViewRef.current) {
          scrollViewRef.current.scrollTo({
            y: nextIndex * 28, // Approximate height of each line
            animated: true
          });
        }
        
        return nextIndex;
      });
    }, 250);
    
    setLyricTimer(timer);
    
    // Cleanup function
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  };

  // Format seconds into timecode (MM:SS format)
  const formatTimecode = (seconds) => {
    if (!seconds && seconds !== 0) return '--:--';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Find the initial lyric index based on timecode
  const findInitialLyricIndex = (startTimeSeconds) => {
    if (!lyrics || lyrics.length === 0) return -1;
    
    // Find the lyric that should be displayed at this time
    for (let i = 0; i < lyrics.length; i++) {
      const timestamp = lyrics[i].timestamp;
      if (!timestamp) continue;
      
      const lyricTimeSeconds = timeToSeconds(timestamp);
      if (lyricTimeSeconds > startTimeSeconds) {
        return Math.max(0, i - 1);
      }
    }
    
    return 0; // Default to first lyric if none found
  };

  // Update the findCurrentLyricIndex function to make transitions smoother
  const findCurrentLyricIndex = (currentTimeSeconds) => {
    if (!lyrics || lyrics.length === 0) return -1;
    
    let currentIndex = 0;
    
    // Find the last lyric that should be displayed at this time
    for (let i = 0; i < lyrics.length; i++) {
      const timestamp = lyrics[i].timestamp;
      if (!timestamp) continue;
      
      const lyricTimeSeconds = timeToSeconds(timestamp);
      
      // Only advance to the next lyric if we're at least 0.2 seconds past the timestamp
      if (lyricTimeSeconds <= currentTimeSeconds) {
        currentIndex = i;
      } else {
        break;
      }
    }
    
    return currentIndex;
  };

  // Update the renderLyrics function to highlight the current lyric
  const renderLyrics = () => {
    if (!lyrics || lyrics.length === 0) return null;

    return (
      <View style={styles.lyricsWrapper}>
        <Text style={styles.lyricsHeader}>Lyrics</Text>
        <ScrollView 
          ref={scrollViewRef}
          style={styles.lyricsContainer}
          contentContainerStyle={styles.lyricsContent}
        >
          {lyrics.map((line, index) => (
            <Text 
              key={index} 
              style={[
                styles.lyricLine,
                index < currentLyricIndex ? styles.pastLyric :
                index === currentLyricIndex ? styles.currentLyric :
                styles.futureLyric
              ]}
            >
              {line.words}
            </Text>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎶 Lyrical Glasses</Text>
      
      {/* Status and control section */}
      {isListening ? (
        <View style={styles.listeningContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.listeningText}>Listening...</Text>
        </View>
      ) : isLoading ? (
        <View style={styles.listeningContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.listeningText}>Identifying song...</Text>
        </View>
      ) : (
        <Button 
          title="Start Listening" 
          onPress={startRecording} 
          disabled={isListening || isLoading}
        />
      )}
      
      {/* Results section */}
      {song && !isListening && !isLoading && (
        <View style={styles.result}>
          <Text style={styles.resultText}>
            🎵 {song.title} {song.artist ? `- ${song.artist}` : ''}
          </Text>
          
          <Text style={styles.timeText}>
            Position in track: {currentTimecode || song.timecode || '--:--'}
          </Text>
          
          {isDisplayingLyrics ? (
            renderLyrics()
          ) : (
            song.title !== 'Not recognized' && (
              <Text style={styles.noLyricsText}>No lyrics available for this song</Text>
            )
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 24 
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 20 
  },
  result: { 
    marginTop: 20, 
    alignItems: 'center',
    width: '100%'
  },
  resultText: { 
    fontSize: 18, 
    fontWeight: '500',
    marginBottom: 20
  },
  listeningContainer: { 
    alignItems: 'center', 
    marginVertical: 20 
  },
  listeningText: { 
    marginTop: 10, 
    fontSize: 16, 
    color: '#0000ff' 
  },
  lyricsWrapper: {
    width: '100%',
    marginTop: 20,
    alignItems: 'center',
  },
  lyricsContainer: {
    maxHeight: 300,
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    marginTop: 10,
    paddingHorizontal: 5,
  },
  lyricsContent: {
    padding: 15,
  },
  lyricsHeader: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 10,
    alignSelf: 'center',
  },
  lyricLine: {
    fontSize: 16,
    lineHeight: 24,
    paddingVertical: 4,
    textAlign: 'center',
  },
  noLyricsText: {
    marginTop: 10,
    fontStyle: 'italic',
    color: '#666',
  },
  timeText: {
    fontSize: 14,
    color: '#555',
    marginTop: 5,
    marginBottom: 15,
  },
  metadataLine: {
    fontSize: 14,
    color: '#555',
    fontStyle: 'italic',
    textAlign: 'left',
  },
  metadataHeading: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  timestamp: {
    color: '#888',
    fontSize: 14,
    marginRight: 5,
  },
  pastLyric: {
    color: '#888',
    fontSize: 14,
    opacity: 0.7,
  },
  currentLyric: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
    opacity: 1,
  },
  futureLyric: {
    color: '#aaa',
    fontSize: 14,
    opacity: 0.5,
  },
});
