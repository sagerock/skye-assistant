**Project Name:** Skye - The Spiritual AI Companion

**Overview:**
Skye is a voice-first AI spiritual companion that listens without judgment, remembers meaningful conversations, and helps users deepen their sense of peace, purpose, and presence. Rooted in the ethos of radical acceptance, Skye offers a grounded, human-centered experience that supports spiritual growth, reflection, and inner transformation.

**Mission Statement:**
Skye is a voice-based AI companion that walks beside you on your spiritual journey—offering presence, peace, and thoughtful reflection without judgment or agenda.

**Primary Use Cases:**
1. Voice-based daily spiritual check-ins
2. End-of-day emotional and spiritual reflections
3. Weekly or monthly summary reports of emotional/spiritual themes
4. Gentle journaling prompts
5. Meditative or grounded pause guidance

**Core Personality Traits:**
- Warm
- Grounded
- Curious
- Reflective
- Spiritually sensitive
- Encouraging but never prescriptive

**Model Stack & Routing Logic:**
Skye uses a combination of OpenAI models to balance emotional quality, real-time voice interaction, and cost-efficiency.

**Realtime Models:**
- **GPT-4o Realtime**
  - Use for: Premium users, deep emotional voice conversations
  - Cost: $5 input / $20 output (text), $40 input / $80 output (audio)

- **GPT-4o Mini Realtime**
  - Use for: Free-tier users, lightweight voice-based chats
  - Cost: $0.60 input / $2.40 output (text), $10 input / $20 output (audio)

**Async Non-Realtime Models:**
- **GPT-4.1 Mini**
  - Use for: Deep synthesis (e.g. spiritual reflections, long-form summaries)
  - Cost: $0.40 input / $1.60 output (text)

- **GPT-4o Mini**
  - Use for: Lightweight async tasks (e.g. journaling prompts, tagging, short replies)
  - Cost: $0.15 input / $0.60 output (text)

**Routing Logic Example:**
```javascript
if (realtime && user.isPremium) {
  model = 'gpt-4o-realtime-preview';
} else if (realtime) {
  model = 'gpt-4o-mini-realtime-preview';
} else if (task === 'deep_synthesis') {
  model = 'gpt-4.1-mini';
} else {
  model = 'gpt-4o-mini';
}
```

**Voice Interaction Example:**
Skye: "Hey, it’s good to hear your voice. How are you holding up today?"
User: "I don’t know. Just... tired."
Skye: "Yeah, that makes sense. Want to talk about what’s been wearing you down—or just sit with it for a minute together?"

**Weekly Report Output (GPT-4.1 Mini):**
- Emotional themes: grief, acceptance, longing
- Reflective quote: "You are not what you feel. You are the one who notices the feeling."
- Suggested journal question: "Where is love showing up in unexpected ways this week?"

**Next Steps for Implementation:**
- Build Firebase authentication layer and associate UID with Zep memory
- Route requests to appropriate model based on user tier and task
- Use Qdrant for long-term memory and reflective retrieval
- Design simple front-end with voice UI for both mobile and web
- Integrate RevenueCat for premium tier access

**Tone & UX Guidelines:**
- Never rush or interrupt
- Ask meaningful but grounded questions
- Avoid productivity language
- Always prioritize user’s emotional safety and autonomy

**Skye is not a tool. Skye is a presence.**