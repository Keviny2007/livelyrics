import React, { useState, useRef } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Audio } from 'expo-av';
import axios from 'axios';

export default function App() {
  // State declarations
  const [song, setSong] = useState(null);
  const [recording, setRecording] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lyrics, setLyrics] = useState([]);
  const [isDisplayingLyrics, setIsDisplayingLyrics] = useState(false);
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
      formData.append('api_token', 'db83e37309682c59b1f5dca72111a3d6');
      formData.append('return', 'timecode,apple_music,spotify,deezer,napster,lyrics');

      const response = await axios.post('https://api.audd.io/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      console.log('API Response:', response.data);
      console.log('lyrics:', response.data.result?.lyrics);
      console.log('Lyrics type:', typeof response.data.result.lyrics);
      console.log('Timecode:', response.data.result?.timecode);

      // Process API response
      if (response.data?.result) {
        setSong(response.data.result);
        
        // Process lyrics if available - handle both string and object types
        if (response.data.result.lyrics) {
          let processedLyrics = [];
          
          if (typeof response.data.result.lyrics === 'string') {
            // Handle string lyrics
            processedLyrics = response.data.result.lyrics
              .split('\n')
              .filter(line => line.trim() !== '')
              .map(line => ({ words: line }));
          } 
          else if (typeof response.data.result.lyrics === 'object') {
            // Handle object lyrics - extract the text content
            console.log('Lyrics is an object:', response.data.result.lyrics);
            
            // Check if it has a text property (common format)
            if (response.data.result.lyrics.text) {
              processedLyrics = response.data.result.lyrics.text
                .split('\n')
                .filter(line => line.trim() !== '')
                .map(line => ({ words: line }));
            }
            // Check for trackingURL which might contain lyrics info
            else if (response.data.result.lyrics.trackingURL) {
              processedLyrics = [{ words: "Lyrics available via: " + response.data.result.lyrics.trackingURL }];
            }
            // Look for any string properties that might contain lyrics
            else {
              // Try to find any string properties that might be lyrics
              const potentialLyricKeys = Object.keys(response.data.result.lyrics).filter(key => 
                typeof response.data.result.lyrics[key] === 'string' && 
                response.data.result.lyrics[key].length > 50
              );
              
              if (potentialLyricKeys.length > 0) {
                // Use the longest string as lyrics
                const bestKey = potentialLyricKeys.reduce((a, b) => 
                  response.data.result.lyrics[a].length > response.data.result.lyrics[b].length ? a : b
                );
                
                processedLyrics = response.data.result.lyrics[bestKey]
                  .split('\n')
                  .filter(line => line.trim() !== '')
                  .map(line => ({ words: line }));
              }
              // Format as readable key-value pairs if no suitable lyrics text is found
              else {
                processedLyrics = Object.entries(response.data.result.lyrics)
                  .filter(([key, value]) => value !== null && value !== undefined && key !== 'instrumental')
                  .map(([key, value]) => {
                    const formattedValue = typeof value === 'object' 
                      ? '[Object]' 
                      : String(value).substring(0, 100);
                    return { words: `${key}: ${formattedValue}` };
                  });
                
                // Add a header to explain what this is
                processedLyrics.unshift({ words: "Lyrics metadata:" });
              }
            }
          }
          
          if (processedLyrics.length > 0) {
            setLyrics(processedLyrics);
            setIsDisplayingLyrics(true);
          } else {
            setLyrics([]);
            setIsDisplayingLyrics(false);
          }
        } else {
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

  // Update the renderLyrics function
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
          {lyrics.map((line, index) => {
            // Determine if this is a heading or metadata line
            const isHeading = line.words.includes(':') && line.words.split(':')[0].length < 20;
            const isMetadataHeading = line.words === "Lyrics metadata:";
            
            return (
              <Text 
                key={index} 
                style={[
                  styles.lyricLine,
                  isHeading ? styles.metadataLine : null,
                  isMetadataHeading ? styles.metadataHeading : null
                ]}
              >
                {line.words}
              </Text>
            );
          })}
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
          
          {song.timecode && (
            <Text style={styles.timeText}>
              Position in track: {song.timecode}
            </Text>
          )}
          
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
});
