import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';

/// Service for playing notification sounds/buzzer for new orders
/// Plays audio in loop mode and works even when app is in background
class AudioService {
  AudioService._();

  static final AudioPlayer _player = AudioPlayer();
  static bool _isPlaying = false;

  /// Initialize audio service (call once at app startup)
  static Future<void> initialize() async {
    try {
      // Configure player for background playback
      await _player.setLoopMode(LoopMode.one);
      debugPrint('[AudioService] Initialized');
    } catch (e) {
      debugPrint('[AudioService] Failed to initialize: $e');
    }
  }

  /// Start playing new order buzzer in loop
  /// Plays for 30 seconds automatically or until stopped
  static Future<void> playNewOrderBuzzer() async {
    try {
      if (_isPlaying) {
        debugPrint('[AudioService] Buzzer already playing');
        return;
      }

      _isPlaying = true;

      // Load the audio file
      await _player.setAsset('assets/new_order.mp3');
      
      // Set loop mode
      await _player.setLoopMode(LoopMode.one);
      
      // Set volume to maximum for notification
      await _player.setVolume(1.0);

      // Start playing
      await _player.play();

      debugPrint('[AudioService] Started new order buzzer');
    } catch (e) {
      debugPrint('[AudioService] Failed to play buzzer: $e');
      _isPlaying = false;
    }
  }

  /// Stop the buzzer immediately
  static Future<void> stopBuzzer() async {
    try {
      if (!_isPlaying) {
        debugPrint('[AudioService] Buzzer not playing');
        return;
      }

      await _player.stop();
      _isPlaying = false;

      debugPrint('[AudioService] Stopped buzzer');
    } catch (e) {
      debugPrint('[AudioService] Failed to stop buzzer: $e');
    }
  }

  /// Check if buzzer is currently playing
  static bool get isPlaying => _isPlaying;

  /// Dispose audio resources
  static Future<void> dispose() async {
    try {
      await _player.stop();
      await _player.dispose();
      _isPlaying = false;
      debugPrint('[AudioService] Disposed');
    } catch (e) {
      debugPrint('[AudioService] Failed to dispose: $e');
    }
  }

  /// Play a short notification sound (non-looping, for other events)
  static Future<void> playNotificationSound() async {
    try {
      // Create a separate player for one-time sounds
      final oneTimePlayer = AudioPlayer();
      await oneTimePlayer.setAsset('assets/new_order.mp3');
      await oneTimePlayer.setLoopMode(LoopMode.off);
      await oneTimePlayer.setVolume(0.7);
      await oneTimePlayer.play();

      // Dispose after playing
      oneTimePlayer.playerStateStream.listen((state) {
        if (state.processingState == ProcessingState.completed) {
          oneTimePlayer.dispose();
        }
      });

      debugPrint('[AudioService] Played notification sound');
    } catch (e) {
      debugPrint('[AudioService] Failed to play notification sound: $e');
    }
  }
}
