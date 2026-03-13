/**
 * Seed concise, attractive descriptions for all menu items.
 * Run: node scripts/seed-descriptions.mjs
 */

import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_a9HTlJp6ifbY@ep-royal-cherry-a1yekkd8-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

// ── Descriptions keyed by item code ──────────────────────────────────────────
// Format: code → English description (≤ ~100 chars, punchy & appetising)
const DESCRIPTIONS = {

  // ── Ala Cart — Chicken ────────────────────────────────────────────────────
  'AC01': 'Crispy chicken tossed in a rich buttery sauce with fragrant curry leaves and chilli.',
  'AC02': 'Tender chicken in our tangy-sweet sauce with vibrant peppers — addictively good.',
  'AC03': 'Golden crispy chicken smothered in creamy, umami-rich salted egg sauce.',
  'AC04': 'Bold wok-fried chicken with a peppery kick and sweet caramelised onions.',
  'AC05': 'Aromatic ginger and spring onion stir-fry — a simple classic done right.',
  'AC06': 'Szechuan-inspired spicy-sweet chicken with roasted peanuts and dried chillies.',
  'AC07': 'Creamy Thai green curry with tender chicken and fragrant kaffir lime. Serves 3–4.',
  'AC08': 'Rich Nanyang coconut curry with fall-off-the-bone chicken. Serves 2.',
  'AC11': 'Fragrant Thai basil stir-fried minced chicken — bold, aromatic, and satisfying.',

  // ── Ala Cart — Eggs ───────────────────────────────────────────────────────
  'AE01': 'Fluffy Thai-style omelette with a crispy golden edge and savory filling.',
  'AE02': 'Classic wok-fried omelette with sweet caramelised onion — homestyle comfort.',
  'AE03': 'Plump prawns folded into a light, golden omelette — simple and satisfying.',
  'AE04': 'Traditional omelette with tender shredded radish — nostalgic homestyle cooking.',
  'AE05': 'Silky egg and juicy tomato in a sweet-savory sauce — a beloved Chinese classic.',

  // ── Ala Cart — Fish ───────────────────────────────────────────────────────
  'AF01': 'Tender fish slices fried crispy and tossed in a rich buttery curry leaf sauce.',
  'AF02': 'Light crispy fish in our signature tangy-sweet sauce.',
  'AF03': 'Fish slices coated in indulgent creamy salted egg sauce.',
  'AF04': 'Crispy fish slices with a bold black pepper glaze.',
  'AF05': 'Delicate fish lifted by aromatic ginger and fresh spring onions.',
  'AF06': 'Whole crispy fish drenched in vibrant Thai sweet-and-spicy sauce. Serves 2–3.',
  'AF06K_Kong_Po_Fish_S': 'Spicy-sweet Szechuan-style fish slices with roasted peanuts.',
  'AF06L_Lemon_Spicy_St': 'Light steamed fish in a zesty spicy lemon sauce — refreshing Thai style. Serves 2–3.',
  'AF07': 'Whole crispy fish in a vibrant sweet-and-sour sauce — great for sharing. Serves 2–3.',
  'AF08': 'Silky steamed fish with soy, ginger, and spring onions — a Hong Kong classic. Serves 2–3.',
  'AF09': 'Whole crispy fish with fragrant Thai herbs and fresh chillies. Serves 2–3.',
  'AF10': 'Slow-simmered Indonesian spicy curry in a claypot. Serves 2–3.',
  'AF11': 'Succulent prawns in rich Indonesian curry claypot. Serves 2–3.',
  'AF12': 'Crispy whole fish in a luscious Thai green curry sauce. Serves 3–4.',
  'AFS3_Salted_Egg_Fish': 'Premium siakap fish slices in creamy, umami-rich salted egg sauce.',
  'AFS1_Buttermilk_Fish': 'Premium siakap fish slices in fragrant buttery curry leaf sauce.',
  'AFS2_Sweet_&_Sour_Fi': 'Premium siakap fish slices in our tangy-sweet signature sauce.',
  'AFS4_Black_Pepper_Fi': 'Premium siakap fish slices with a bold black pepper glaze.',
  'AFS5_Ginger_Onion_Fi': 'Premium siakap fish slices with aromatic ginger and spring onion.',
  'AFS6K_Kong_Po_Fish_S': 'Premium siakap fish slices in spicy-sweet Szechuan sauce with peanuts.',

  // ── Ala Cart — Soups ──────────────────────────────────────────────────────
  'AS01': 'Fragrant Thai tom yum with tender chicken — spicy, sour, and soul-warming.',
  'AS01B_Chicken_Tomyum': 'The same beloved tom yum, bigger and better for sharing.',
  'AS02': 'Spicy Thai tom yum packed with fresh seafood — a table favourite.',
  'AS02B_Seafood_Tomyum': 'A generous seafood tom yum — bold, tangy, and made for sharing.',
  'AS10': 'Light, nourishing house chicken broth — simmered fresh daily.',
  'AS10B_Daily_Chicken_': 'Our daily chicken broth in a bigger portion — perfect for sharing.',
  'AS11B_Choy_Sum_Soup': 'Tender choy sum in a clear, comforting chicken broth.',

  // ── Ala Cart — Vegetables & Sides ─────────────────────────────────────────
  'AV01': 'Wok-tossed water spinach in spicy shrimp paste — addictive and fragrant.',
  'AV02': 'Simply stir-fried water spinach with fragrant garlic — clean and wholesome.',
  'AV03': 'Golden fried tofu with Thai-spiced sauce — crispy outside, silky inside.',
  'AV04': 'Colourful seasonal vegetables wok-fried in a light savoury sauce.',
  'AV05': 'Tender squid in a bright Thai lemon chilli sauce — fresh and refreshing.',
  'AV06': 'Crisp choy sum tossed with fragrant garlic — simple and satisfying.',
  'AV07': 'Light and crunchy bean sprouts stir-fried with garlic.',
  'AV08': 'Bean sprouts elevated with the umami punch of fried salted fish.',
  'AV09': 'House-special silken tofu in a bright sweet-sour sauce — a crowd favourite.',
  'AV10': 'Silky tofu with fresh seafood in a smooth velvety egg gravy.',
  'AV11': 'Tender okra stir-fried with garlic — simple, delicious, and clean.',
  'AV12': 'Sweet cabbage and juicy shrimp in a fragrant savoury stir-fry.',
  'AV13': 'Classic wok-fried water spinach with good wok hei.',
  'AV14': 'Crispy wok-fried okra with fragrant aromatics.',
  'AV15': 'Tender mushrooms wok-tossed with garlic and light seasoning.',
  'AV16': 'Crunchy long beans stir-fried with fragrant dried shrimp.',
  'AV17': 'Four Chinese vegetables — lotus root, lily bud, cloud ear, and ginkgo — in one dish.',
  'AV18': 'Sweet potato leaves in spicy sambal — Malaysian street-food soul on a plate.',
  'AV19': 'Tender sweet potato leaves simply stir-fried with garlic.',
  'AV20': 'Thinly sliced beef with sweet caramelised onion in a Japanese-inspired sauce.',
  'AV21': 'Tender beef slices in a bold, peppery black pepper sauce.',
  'AV22': 'Rich, fiery beef curry slow-cooked in a claypot — deep and complex. Serves 3–4.',
  'AV23': 'Fragrant Thai basil stir-fried beef — bold, aromatic, and irresistible.',
  'AV24': 'Spicy-sweet Szechuan-style beef with roasted peanuts and dried chillies.',
  'AV30': 'Fragrant Thai basil minced chicken served over silky Japanese tofu.',
  'AV70': 'Juicy prawns tossed in a buttery, curry-leaf-infused sauce.',
  'AV71': 'Succulent prawns in indulgent creamy salted egg sauce.',
  'AV72': 'Plump prawns in a bold, fragrant black pepper glaze.',
  'AV73': 'Prawns in spicy-sweet Szechuan sauce with roasted peanuts.',

  // ── Desserts ──────────────────────────────────────────────────────────────
  'DD01': 'Ask our team for today\'s sweet treat — made fresh daily.',
  'DD02': 'Colourful coconut dessert with yam, sweet potato, and sago — a Nyonya classic.',
  'Gui_lin_gao/Chinese_': 'Cooling herbal jelly — subtly bitter, naturally refreshing. A traditional favourite.',

  // ── Addons ────────────────────────────────────────────────────────────────
  'ADD04': 'Fluffy steamed jasmine rice — the perfect companion to any dish.',
  'ADD05': 'Coconut-steamed rice with sambal, ikan bilis, peanuts, and cucumber.',
  'ADD06': 'Golden crispy fried chicken — a crowd-pleasing add-on.',
  'ADD10': 'Two succulent prawns — great for bulking up your sharing set.',
  'ADD11': 'Three tender squid pieces to complement your sharing set.',
  'ADD01': 'A simple, satisfying fried egg — always a good addition.',

  // ── Rice Dishes (TM) ──────────────────────────────────────────────────────
  'TM06': 'Thai-style fried rice wrapped in a golden omelette — fun and satisfying.',
  'TM07': 'Fragrant fried rice with tender beef and wok hei.',
  'TM08': 'Classic wok-fried rice with egg and seasoned chicken.',
  'TM09': 'Simple, well-seasoned Chinese-style fried rice with egg.',
  'TM10': 'Turmeric chicken rice — golden, fragrant, and full of warmth.',
  'TM11': 'Aromatic Kam Heong-style chicken served over steamed rice.',
  'TM12': 'Silky Japanese tofu and chicken over fluffy steamed rice.',

  // ── Must-Try ──────────────────────────────────────────────────────────────
  'MT04': 'Spicy tom yum with fresh seafood, rice, and egg — a complete meal in one bowl.',
  'MT01': 'Fragrant fried rice served in a real pineapple — sweet, savoury, and tropical.',
  'Thai-styled_green_cu': 'Creamy Thai green curry over fluffy rice — aromatic and deeply satisfying.',
  'MT01B_Pineapple_Frie': 'Our signature pineapple fried rice for two — tropical, festive, and delicious.',
  'MT02': 'Wok-tossed fried rice with fresh seafood and egg.',
  'MT02B_Seafood_Fried_': 'Generous seafood fried rice for sharing — great for two.',
  'MT05': 'Comforting tomyum chicken soup served with steamed rice.',
  'TM04': 'Rustic village-style fried rice with anchovies, egg, and sambal.',

  // ── Try Me ────────────────────────────────────────────────────────────────
  'TM03': 'Thinly sliced beef in a sweet-savoury Japanese-inspired sauce over rice.',
  'TM01': 'Spicy sambal-infused fried rice — smoky, bold, and addictive.',
  'TM01B_Sambal_Fried_R': 'Our spicy sambal fried rice, bigger portion for sharing.',
  'TM02': 'Thai tomyum-spiced fried rice — tangy, aromatic, and bold.',
  'TM02B_Tomyum_Seafood': 'Tomyum-spiced fried rice with seafood — great for two.',
  'TM04B_Kampung_Fried_': 'Classic kampung fried rice for two — rustic, homey, and satisfying.',
  'TM05': 'Spicy minced meat over rice — bold, hearty, and full of flavour.',
  'TM05B_CHILLI_MINCED_': 'Spicy minced meat rice for sharing — double the heat, double the fun.',

  // ── Ayam Penyet ───────────────────────────────────────────────────────────
  'AP01': 'Smashed crispy Indonesian chicken on rice with fiery sambal — a street-food legend.',
  'AP02': 'Smashed crispy chicken on coconut rice with sambal — the best of both worlds.',
  'AP03': 'Crispy smashed chicken on tangy Mee Siam noodles — a bold combo.',
  'AP04': 'Crispy smashed chicken on spiced Meena noodles.',

  // ── Break-Lunch ───────────────────────────────────────────────────────────
  'BF01': 'Rich KL-style curry soup with noodles — hearty, aromatic, and spiced just right.',
  'BF02': 'Bold KL-style curry with noodles, dry-cooked for a more intense flavour.',
  'BF04': 'Delicate fish head in a creamy milk broth — comforting and uniquely delicious.',
  'BF03': 'Tender fish slices in a light, comforting milk soup.',
  'BF05': 'Indonesian-inspired peanut sauce noodles with vegetables — nutty and satisfying.',
  'BF06': 'Tender Malay-style curry chicken over steamed rice — a reliable lunch favourite.',
  'BF06B_Malay_Curry_Ch': 'Malay curry chicken for two, served with steamed rice — great value sharing.',
  'BF07': 'Smooth fish slices in a clear, nourishing broth.',
  'BF08': 'Spicy Thai tom yum Mama noodle — elevated with real broth and fresh toppings.',
  'LUNCH_PROMO': 'Today\'s special lunch set — great value, full flavour. Ask our team!',
  'Break-Lunch_Promotio': 'Special promo — a satisfying meal at an unbeatable price. Limited daily.',

  // ── Classic Fried Noodles ─────────────────────────────────────────────────
  'CN01': 'Golden crispy rice vermicelli — a satisfying, textured delight.',
  'CN02': 'Silky rice noodles in a smooth velvety egg gravy — a Cantonese classic.',
  'CN03': 'Flat rice noodles wok-fried with egg and bean sprouts — simple and good.',
  'CN04': 'Mamak-style yellow noodles — spiced and full of street-food character.',
  'CN05': 'Stir-fried rice vermicelli with egg and vegetables — a classic light meal.',
  'CN06': 'Flat rice noodles and yellow noodles wok-tossed together for extra texture.',

  // ── Sharing Sets ──────────────────────────────────────────────────────────
  'CS01': 'A complete chicken sharing feast for two — great value with rice and sides.',
  'CS04': 'Generous fish slices sharing set for two — flavourful and satisfying.',
  'CS07': 'A full fried rice feast for two with sides — perfect for sharing.',

  // ── Daily Special Soup ────────────────────────────────────────────────────
  'DS01': 'Comforting Chinese ABC soup with carrot, potato, and tomato over rice.',
  'DS02': 'Clear, nourishing chicken soup with sweet radish over rice.',
  'DS03': 'Fragrant herbal chicken soup — slow-simmered for deep nourishment. Served with rice.',
  'DS04': 'Light and refreshing watercress chicken soup over steamed rice.',
  'DS05': 'Traditional old cucumber chicken soup — cooling and restorative. Served with rice.',
  'DS06': 'Hearty lotus root and peanut chicken soup — a classic Chinese comfort with rice.',
  'DS07': 'Cooling winter melon chicken soup — delicate, soothing, and nourishing.',
  'DS11': 'Our daily chicken soup with one portion of rice — simple, wholesome, satisfying.',
  'DS12': 'Our daily chicken soup with two portions of rice — share a warm meal together.',

  // ── Noodle Soup ───────────────────────────────────────────────────────────
  'ND01': 'Silky flat noodles with tender shredded chicken — dry-style and light.',
  'ND02': 'Delicate rice vermicelli with shredded chicken — dry-style, simple and clean.',
  'NS01': 'Silky flat noodles with shredded chicken in a clear, comforting broth.',
  'NS02': 'Delicate glass noodles with shredded chicken in a light soup.',
  'NS03': 'Spicy Thai tom yum with fresh seafood and rice vermicelli — bold and vibrant.',
  'NS04': 'Fragrant tom yum chicken soup with rice vermicelli — spicy and warming.',
  'NS05': 'Rice vermicelli with tender shredded chicken in a clear, nourishing broth.',
  'NS06': 'Spicy tom yum seafood with Mama noodles — comforting and intensely flavourful.',

  // ── Snacks ────────────────────────────────────────────────────────────────
  'SF01': 'Crispy golden fries — the perfect crowd-pleasing snack.',
  'SF01B_Little_Spicy_F': 'Crispy fries with a satisfying chilli kick.',
  'SF01BC_Cheese_Little': 'Spicy fries topped with melted cheese — indulgent and delicious.',
  'SF01BM_Sweet_Little_': 'Fries with a playful sweet-spicy twist.',
  'SF02': 'Juicy golden chicken nuggets — great for snacking or sharing.',
  'SF03': 'Thick Malaysian fish crackers — chewy, savoury, and satisfying.',
  'SF04': 'Thin crispy Malaysian fish crackers — light, crunchy, and addictive.',
  'SF05': 'Bite-sized crispy chicken — perfectly seasoned and impossible to stop eating.',
  'SF06': 'Crispy bean curd skin — light, golden, and addictive.',
  'SF07': 'Golden crispy tofu and tempeh — a plant-based snack with character.',
  'SF08': 'Crispy fritters packed with prawns and vegetables — great for sharing.',
  'SF09': 'Fresh garden salad with fragrant sesame dressing. Pre-order recommended.',
  'SF10': 'Crisp salad with creamy Thousand Island dressing. Pre-order recommended.',
  'SF11': 'Crispy chicken wings with Thai-spiced marinade — bold, sticky, and addictive.',
  'SF12': 'Golden whole prawns with Thai seasoning — crispy, juicy, and flavourful. 8pcs.',
  'SF13': 'Tender squid in a light crispy batter — Thai-seasoned to perfection.',
  'SF16': 'Crispy tofu skin wrapped around seasoned fish paste — a flavourful bite.',
  'SF17': 'Golden fried fish balls — bouncy, flavourful, and satisfying.',
  'SF18': 'Crispy pan-fried shrimp cakes — a classic Nanyang snack.',
  'SF19': 'Crispy golden wontons with a savoury filling — light and addictive.',
  'SF21': 'BBQ chicken wings air-fried to golden perfection — healthier, still delicious.',
  'SF22': 'One piece of golden fried fish cake — bouncy, savoury, and fresh.',
  'SF22B_Fried_Fish_Cak': 'Three pieces of golden crispy fish cake — great for sharing.',
  'SF22P_Fried_Fish_Cak': 'Special fish cake offer with sharing set purchase (min. 2pcs).',
  'SF23': 'Flaky pastry filled with spiced vegetable curry — a Malaysian bakery classic.',
  'SF24': 'Crispy golden pastry stuffed with well-spiced vegetables.',
  'SF25': 'Light and crispy spring roll with a wholesome vegetable filling.',

  // ── Toast ─────────────────────────────────────────────────────────────────
  'T100': 'Thick toast with creamy butter and pandan kaya — a Malaysian breakfast icon.',
  'T101': 'Classic kaya jam on toast — sweet, fragrant, and perfectly simple.',
  'T102': 'Toasted bread loaded with melted cheese — warm, gooey, and satisfying.',
  'T103': 'Creamy mayo and melted cheese on crispy toast — rich and indulgent.',
  'T104': 'The ultimate toast — butter, kaya, and peanut butter layered together.',
  'T105': 'Sweet Milo-spread toast — a nostalgic childhood treat.',
  'T106': 'Indulgent chocolate spread on golden toast — a sweet morning start.',
  'T107': 'Soft polo bun with a generous, buttery filling — pillowy and comforting.',
  'T108': 'Classic peanut spread on warm crispy toast — simple and good.',
  'T109': 'Rich, smooth peanut butter on golden toast.',
  'T110': 'Buttery flaky croissant with a creamy egg mayo filling.',
  'T111': 'Flaky croissant with rich butter and pandan kaya.',
  'T112': 'Flaky croissant filled with creamy tuna mayo.',
  'T113': 'Soft bread with a generous, creamy egg mayo filling.',
  'T114': 'Sandwich with a spicy, fragrant sambal spread — a bold breakfast option.',
  'T115': 'Classic tuna mayo sandwich — satisfying, fresh, and reliable.',
  'T116': 'Tuna mayo with melted cheese — a step above the classic.',
  'T117': 'Kaya jam with margarine on warm toast — a simple, comforting classic.',
  'T118': 'Sweet milk and margarine on crispy toast.',
  'T119': 'Buttery toast with a sweet caramelised sugar crust.',
  'T120': 'Creamy curry chicken paired with two slices of toast.',
  'T121': 'Silky half-boiled eggs — a classic breakfast companion.',
  'T122': 'Soft and fluffy original polo bun — simple and satisfying.',
  'T123': 'Polo bun filled with melted cheese and egg — rich and indulgent.',
  'T124': 'Polo bun served with ice cream — a fun, sweet, and cooling treat.',
  'T125': 'Buttery, flaky plain croissant — beautifully simple.',
  'T126': 'Flaky croissant with spicy sambal and a perfectly cooked egg.',
  'T127': 'Egg mayo with melted cheese in a soft, satisfying sandwich.',
  'T128': 'Spicy sambal with egg in a soft, pillowy sandwich.',
  'T129': 'Comforting spiced curry potato with two slices of toast.',
  'JP04': 'Complete breakfast set — polo bun with butter, soft egg, and your choice of drink.',

  // ── Thai Fish Sharing Sets ─────────────────────────────────────────────────
  'Thai_Fish_Set_2pax': 'A generous Thai-style fish feast for two — complete with sides.',
  'DINNER_SHARING_PROMO': 'Best value dinner sharing set — a Thai seafood spread for the table.',
  'FS04': 'A lavish Thai fish feast for the whole family. Serves 3–4.',
  'FS07': 'A grand sharing feast with premium Thai fish and sides. Serves 4–5.',

  // ── Value Sets ────────────────────────────────────────────────────────────
  'JP01': 'Classic Malaysian breakfast — toast, soft-boiled egg, and your choice of drink.',
  'JP03': 'Double sandwich set — cheese toast and tuna mayo for a filling breakfast.',
  'JP06': 'Comforting curry chicken paired with toast — a beloved local combo.',
  'P14': 'Tender fish slices in milk soup with noodles and a drink — complete and nourishing.',

  // ── 7 Lunch Lovers ────────────────────────────────────────────────────────
  'LL01': 'Crispy buttermilk chicken, steamed rice, and a fried egg — a complete lunch.',
  'LL02': 'Golden buttermilk fish, steamed rice, and a fried egg — satisfying lunch set.',
  'LL03': 'Sweet-and-sour chicken, steamed rice, and a fried egg — a balanced lunch.',
  'LL04': 'Sweet-and-sour fish, steamed rice, and a fried egg — bright and satisfying.',
  'LL05': 'Crispy salted egg chicken, rice, and a fried egg — an indulgent lunch deal.',
  'LL06': 'Creamy salted egg fish, rice, and a fried egg — rich and flavourful.',
  'LL07': 'Bold black pepper chicken, steamed rice, and a fried egg — hearty and filling.',
  'LL08': 'Bold black pepper fish, rice, and a fried egg — a peppery, satisfying lunch.',
  'LL09': 'Ginger onion chicken, steamed rice, and a fried egg — aromatic and comforting.',
  'LL10': 'Ginger onion fish, steamed rice, and a fried egg — light and fragrant.',
  'LL11': 'Kong Po chicken, steamed rice, and a fried egg — spicy-sweet and satisfying.',
  'LL12': 'Kong Po fish, steamed rice, and a fried egg — bold Szechuan flavours.',
  'LL13': 'Black pepper beef, steamed rice, and a fried egg — a heartier lunch choice.',
  'LL14': 'Kong Po beef, rice, and a fried egg — bold flavours, great value.',
  'LL15': 'Buttermilk shrimp, steamed rice, and a fried egg — indulgent lunch set.',
  'LL16': 'Sweet-and-sour shrimp, rice, and a fried egg — tangy, juicy, and satisfying.',
  'LL17': 'Salted egg shrimp, rice, and a fried egg — creamy, rich, and flavourful.',
  'LL18': 'Black pepper shrimp, rice, and a fried egg — bold and peppery.',
  'LL19': 'Ginger onion shrimp, rice, and a fried egg — light and aromatic.',
  'LL20': 'Kong Po shrimp, rice, and a fried egg — spicy-sweet with roasted peanuts.',
  'LL21': 'Ginger onion beef, rice, and a fried egg — a hearty, aromatic lunch.',

  // ── Classic Nanyang ───────────────────────────────────────────────────────
  'M01': 'Tangy tamarind rice vermicelli with a soft-boiled egg — a Nanyang staple.',
  'M02': 'Tangy Mee Siam with golden crispy fried chicken — a classic pairing.',
  'M03': 'Tangy Mee Siam topped with rich, fragrant curry chicken.',
  'M04': 'Mee Siam with sweet-spiced red braised chicken.',
  'M05': 'Mee Siam with slow-cooked, aromatic rendang chicken.',
  'M06': 'Thick egg noodles in a sweet potato gravy — a Malaysian comfort classic.',
  'M07': 'Classic Mee Rebus topped with golden crispy fried chicken.',
  'M11': 'Delicate rice vermicelli in fish sauce broth with a soft-boiled egg.',
  'M12': 'Rice vermicelli in fish sauce broth with crispy fried chicken.',
  'M13': 'Rice vermicelli in fish sauce broth topped with rich curry chicken.',
  'M14': 'Rice vermicelli in fish sauce broth with slow-cooked rendang chicken.',
  'MN01': 'Spiced Meena noodles with a soft-boiled egg — a Nanyang original.',
  'MN02': 'Meena noodles with golden crispy fried chicken.',
  'MN03': 'Meena noodles topped with rich, fragrant curry chicken.',
  'MN04': 'Meena noodles with sweet-spiced red braised chicken.',
  'MN05': 'Meena noodles with slow-cooked, fragrant rendang chicken.',
  'MN06': 'Meena noodles with smashed crispy Indonesian ayam penyet.',
  'MP02': 'Value-packed Nanyang combo — great flavours at a great price.',
  'N01': 'Malaysia\'s iconic coconut rice with sambal, anchovies, and a soft-boiled egg.',
  'N02': 'Classic Nasi Lemak with golden, crispy fried chicken.',
  'N03': 'Nasi Lemak topped with rich, fragrant curry chicken.',
  'N04': 'Nasi Lemak with sweet-spiced red braised chicken.',
  'N05': 'Nasi Lemak with slow-cooked, aromatic rendang chicken.',

  // ── Ice Cream ─────────────────────────────────────────────────────────────
  'IC01': 'Rich palm sugar ice cream — a Malaysian heritage flavour in every scoop.',
  'IC02': 'Creamy salted egg ice cream with Oreo crumble — indulgently unique.',
  'IC03': 'Silky tofu pudding-inspired ice cream — delicate, nostalgic, and smooth.',
  'IC04': 'Refreshing soursop sorbet — tropical, light, and naturally sweet.',
  'IC05': 'Bright, zesty Japanese yuzu sorbet — clean, tart, and refreshing.',
  'IC06': 'Rich, creamy durian ice cream — for the brave and the devoted.',
  'IC07': 'Fresh, bright strawberry ice cream — a timeless crowd-pleaser.',
  'IC08': 'Deep, indulgent chocolate ice cream — rich and satisfying.',
  'IC09': 'Classic creamy French vanilla — smooth, elegant, and timeless.',
  'IC10': 'Cool refreshing mint paired with crunchy chocolate chips.',
  'IC11': 'Creamy ice cream with crumbled cookies — a fun and satisfying classic.',

  // ── Fresh Fruit Juices ────────────────────────────────────────────────────
  'DM07': 'Freshly squeezed lime juice — zingy and refreshing.',
  'FJ01': 'Freshly squeezed orange juice — bright, vibrant, and vitamin-packed.',
  'FJ01X_Fresh_Orange_J': 'Pure fresh orange juice without ice — full citrus intensity.',
  'FJ02': 'Sweet, aromatic fresh mandarin orange juice.',
  'FJ03': 'Crisp, refreshing fresh green apple juice.',
  'FJ03X_Fresh_Green_Ap': 'Pure fresh green apple juice without ice — intensely crisp.',
  'FJ04': 'Tropical sweet-tangy fresh pineapple juice.',
  'FJ04X_Fresh_Pineappl': 'Pure fresh pineapple juice without ice — undiluted tropical goodness.',
  'FJ05': 'Naturally sweet fresh carrot juice — nourishing and vibrant.',
  'FJ05X_Fresh_Carrot_J': 'Pure fresh carrot juice without ice — smooth and wholesome.',
  'FJ06': 'Creamy carrot juice blended with milk — smooth and nutritious.',
  'FJ06X_Fresh_Carrot_M': 'Creamy carrot milk juice without ice — rich and nourishing.',
  'FJ07': 'Sweet tropical guava juice — refreshing and naturally fragrant.',
  'FJ08': 'Tangy passion fruit juice sweetened with honey — tropical and uplifting.',
  'FJ09': 'Tropical soursop juice — subtly sweet, aromatic, and refreshing.',
  'FJ10': 'Exotic tropical fruit juice — try something different today.',
  'FJ11': 'Delicate Taiwanese fig jelly drink — light, cooling, and uniquely textured.',
  'FJ12': 'Pure organic soy milk — rich, smooth, and naturally nourishing.',
  'FJ13': 'Fragrant chrysanthemum tea — floral, cooling, and soothing.',
  'FJ14': 'Refreshing aloe vera drink sweetened with honey — hydrating and light.',
  'FJ15': 'Organic soy milk with cooling grass jelly — a classic pairing.',

  // ── Signature Cold Drinks ─────────────────────────────────────────────────
  'C314': 'Our signature house-made iced lemon tea — the perfect thirst quencher.',
  'C315': 'Fresh lemon with honey on ice — naturally refreshing and bright.',
  'C316': 'Fresh squeezed lime on ice — zingy and cooling.',
  'C317': 'Cooling herbal tea on ice — a soothing traditional blend.',
  'C322': 'Freshly squeezed lemonade on ice — crisp, tangy, and refreshing.',
  'C323': 'Light iced peach tea with fresh fruit — elegant and naturally sweet.',
  'C324': 'Iced peach tea with lemon — aromatic, light, and refreshing.',
  'C327': 'Classic Malaysian iced barley — cooling, naturally sweet, and comforting.',
  'C300': 'Unique tea-and-cocoa blend on ice — a Southeast Asian specialty.',
  'C430': 'Cold classic ginger milk tea — spiced, creamy, and warming.',
  'C431': 'Cold classic ginger tea — aromatic, spiced, and refreshing.',
  'C224L_Plain_Water_wi': 'Chilled plain water with a squeeze of lemon — clean and refreshing.',

  // ── Hot Drinks ────────────────────────────────────────────────────────────
  'H200': 'Coffee and cocoa blended together — a Nanyang specialty that warms the soul.',
  'H202': 'Classic Nanyang cham — the perfect blend of coffee and tea.',
  'H211': 'Traditional hot ginger tea — warming, aromatic, and soothing.',
  'H212': 'Spiced ginger tea with creamy milk — a comforting classic.',
  'H216': 'Our signature hot lemon tea — bright, aromatic, and warming.',
  'H217': 'Fresh lemon with honey served hot — soothing and naturally sweet.',
  'H225': 'Hot barley tea — traditionally brewed, warming, and naturally sweet.',
  'H224L_Plain_Water_wi': 'Warm water with a squeeze of lemon — gently refreshing.',
  'H226': 'Fragrant hot Chinese tea — light, clean, and soothing.',
  'B412': 'Warming ginger milk tea in a generous large cup — spiced and comforting.',
  'B413': 'Classic warming ginger tea in a generous large cup — aromatic and soothing.',
};

async function main() {
  const codes = Object.keys(DESCRIPTIONS);
  console.log(`Seeding descriptions for ${codes.length} items...`);

  let updated = 0;
  let notFound = 0;

  for (const code of codes) {
    const description = DESCRIPTIONS[code];
    const result = await sql`
      UPDATE menu_items
      SET description = ${description}, updated_at = now()
      WHERE code = ${code}
      RETURNING code, name_en
    `;
    if (result.length > 0) {
      updated++;
      console.log(`  ✓ ${code} — ${result[0].name_en}`);
    } else {
      notFound++;
      console.warn(`  ✗ NOT FOUND: ${code}`);
    }
  }

  console.log(`\nDone. Updated: ${updated} | Not found: ${notFound}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
