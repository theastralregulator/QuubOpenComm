import 'package:supabase_flutter/supabase_flutter.dart';

Future<void> bootstrap() async {
  // Suppress errors if keys are not configured yet
  try {
    await Supabase.initialize(
      url: 'https://placeholder.supabase.co',
      anonKey: 'placeholder-anon-key',
    );
  } catch (e) {
    print('Supabase initialization deferred: $e');
  }
}
