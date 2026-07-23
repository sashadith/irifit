// Stillgelegt (23.07.2026, Session 11): Beta-Trial-Workaround — ersetzt durch
// RevenueCat. Bewusst 410, damit die öffentliche Function keine Trials mehr vergibt.
Deno.serve(() => new Response('gone', { status: 410 }));
