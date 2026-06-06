import { Audio } from 'expo-av';
import { Platform } from 'react-native';

const CLOUDINARY_CLOUD = 'dmshdv3eu';
const CLOUDINARY_PRESET = 'ml_default';
const MAX_DURATION = 30000; // 30 segundos

// Configura permissões de áudio
export async function setupAudio(): Promise<boolean> {
  try {
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) return false;
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    return true;
  } catch {
    return false;
  }
}

// Inicia gravação
export async function startRecording(): Promise<Audio.Recording | null> {
  try {
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync({
      android: {
        extension: '.m4a',
        outputFormat: Audio.AndroidOutputFormat.MPEG_4,
        audioEncoder: Audio.AndroidAudioEncoder.AAC,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
      },
      ios: {
        extension: '.m4a',
        outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
        audioQuality: Audio.IOSAudioQuality.HIGH,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {
        mimeType: 'audio/webm',
        bitsPerSecond: 128000,
      },
    });
    await recording.startAsync();
    return recording;
  } catch (e) {
    console.error('Erro ao iniciar gravacao:', e);
    return null;
  }
}

// Para gravação e retorna URI
export async function stopRecording(
  recording: Audio.Recording
): Promise<string | null> {
  try {
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    const uri = recording.getURI();
    return uri || null;
  } catch (e) {
    console.error('Erro ao parar gravacao:', e);
    return null;
  }
}

// Faz upload para Cloudinary e retorna URL
export async function uploadAudio(uri: string): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri,
      type: 'audio/m4a',
      name: `audio_${Date.now()}.m4a`,
    } as any);
    formData.append('upload_preset', CLOUDINARY_PRESET);
    formData.append('resource_type', 'video'); // Cloudinary usa video para audio

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/video/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    const data = await response.json();
    if (data.secure_url) {
      console.log('Audio enviado:', data.secure_url);
      return data.secure_url;
    }
    return null;
  } catch (e) {
    console.error('Erro ao enviar audio:', e);
    return null;
  }
}

// Reproduz áudio
export async function playAudio(
  url: string,
  onFinish?: () => void
): Promise<Audio.Sound | null> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });
    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true }
    );
    if (onFinish) {
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) {
          onFinish();
        }
      });
    }
    return sound;
  } catch (e) {
    console.error('Erro ao reproduzir audio:', e);
    return null;
  }
}

export { MAX_DURATION };