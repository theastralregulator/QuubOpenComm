import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app/app.dart';
import 'app/bootstrap.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Custom bootstrapper for initializations (like Supabase, FCM)
  await bootstrap();

  runApp(
    const ProviderScope(
      child: OpenCommApp(),
    ),
  );
}
