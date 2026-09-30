# Frontend
cloudflared tunnel --url http://localhost:5173

# Backend
cloudflared tunnel --url http://localhost:5000

# Livekit
cloudflared tunnel --url http://localhost:7880

# Stripe
 stripe listen `                                                                    
>>   --all-snapshot `
>>   --forward-to https://sublease-detached-glutinous.ngrok-free.dev/webhooks/stripe

# Livekit server local
 Push-Location tools\livekit;                                                                                                      
.\livekit\livekit-server.exe --config .\livekit.yaml                                                                                                                  