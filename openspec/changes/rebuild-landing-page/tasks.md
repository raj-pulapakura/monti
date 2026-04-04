## 1. Scaffold and extract

- [x] 1.1 Create `web/app/components/marketing-landing.tsx` and move the `MarketingLanding` component out of `page.tsx`
- [x] 1.2 Update `page.tsx` to import and render the extracted component, verify the session-aware routing still works

## 2. Hero section

- [x] 2.1 Build the hero section with new headline ("Make learning something they *do*."), subline, primary CTA ("Get started free" → `/auth/sign-up`), and secondary CTA ("See it in action" → scroll anchor)
- [x] 2.2 Add the hero asset placeholder area (styled container for a future screen recording or screenshot)
- [x] 2.3 Apply display-script italic treatment to the emphasized word "do" in the headline

## 3. Showcase section

- [x] 3.1 Build the "Show, don't tell" section with a kicker, heading, and a grid of 2-3 example experience cards
- [x] 3.2 Each card includes: topic label, audience tag, format tag, and a styled placeholder for the experience visual
- [x] 3.3 Style the placeholder state so cards look intentional even without final assets

## 4. How it works section

- [x] 4.1 Build the 3-step section: Describe → Refine → Share, each with a label, short description, and visual placeholder area
- [x] 4.2 Style the step layout (horizontal on desktop, vertical stack on mobile) with connecting flow indicators

## 5. Who it's for section

- [x] 5.1 Build the persona section with kicker ("Built for anyone who teaches") and 2-3 persona cards
- [x] 5.2 Each card includes: persona label (Classroom teachers, Tutors, Parents) and a representative scenario quote

## 6. Pricing section

- [x] 6.1 Rebuild the pricing section with updated header copy ("Start free. Upgrade when you're ready.") — remove "classroom" language
- [x] 6.2 Retain pricing data sourced from the shared billing contract, keep Free/Paid card structure and CTA routing

## 7. Final CTA and footer

- [x] 7.1 Build the closing CTA section with a motivating headline ("Your next lesson is a conversation away.") and primary sign-up button

## 8. Styling

- [x] 8.1 Remove old `.landing-*` CSS classes from `globals.css`
- [x] 8.2 Write new landing CSS using existing Sunlit Atelier tokens (surfaces, brand, typography, elevation, motion)
- [x] 8.3 Ensure responsive layout: sections stack vertically on mobile, hero asset and step flow adapt gracefully
- [x] 8.4 Add subtle scroll-triggered fade-in transitions for sections below the fold
