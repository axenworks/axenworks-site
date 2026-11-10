import re
OWNER='Freddie Joseph Green'
ADDR='Upover, Stockleigh English, Crediton, EX17 4DD'
UPDATED='10 November 2026'
FAV='<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 64 64%27%3E%3Crect width=%2764%27 height=%2764%27 rx=%2714%27 fill=%27%232430d6%27/%3E%3Cpath d=%27M20 46 32 16l12 30M24.5 36h15%27 stroke=%27white%27 stroke-width=%276%27 fill=%27none%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E">'
def page(slug,title,desc,body):
    toc=''.join('<li><a href="#%s">%s</a></li>'%(i,t) for i,t in re.findall(r'<h2 id="([^"]+)">([^<]+)</h2>',body))
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title} | Axencraft</title>
<meta name="description" content="{desc}">
{FAV}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&display=swap" rel="stylesheet">
<style>
:root{{--blue:#2430d6;--bg:#f7f8f6;--ink:#16181d;--muted:#585e69;--line:#d9dcd6;--card:#fff}}
@media (prefers-color-scheme:dark){{:root{{--bg:#101216;--ink:#eef0ee;--muted:#a3a9b2;--line:#2a2e36;--card:#171a20;--blue:#7d86ff}}}}
*,*::before,*::after{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);font:17px/1.65 "Bricolage Grotesque",system-ui,-apple-system,"Segoe UI",sans-serif}}
a{{color:var(--blue)}}
:focus-visible{{outline:3px solid #ffb703;outline-offset:3px}}
nav{{display:flex;justify-content:space-between;align-items:center;padding:18px 24px;max-width:1040px;margin:0 auto}}
nav a{{text-decoration:none;color:inherit}} nav .brand{{font-weight:800;font-size:20px;letter-spacing:-.02em}} nav .r{{font-size:15px;color:var(--muted);font-weight:600}}
main{{max-width:760px;margin:12px auto 64px;padding:0 22px}}
h1{{font-size:clamp(32px,6vw,44px);letter-spacing:-.03em;line-height:1.1;margin:8px 0 6px}}
.meta{{color:var(--muted);margin:0 0 24px;font-size:15px}}
h2{{font-size:23px;letter-spacing:-.02em;margin:36px 0 8px;scroll-margin-top:16px}}
h3{{font-size:18px;margin:22px 0 6px}}
p,li{{max-width:68ch}} ul{{padding-left:22px}} li{{margin:4px 0}}
.box{{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 22px;margin:18px 0}}
.toc ol{{list-style:none;margin:6px 0 0;padding-left:0;columns:2;column-gap:28px;font-size:15px}} @media(max-width:560px){{.toc ol{{columns:1}}}}
table{{border-collapse:collapse;width:100%;font-size:15px;margin:10px 0}} th,td{{text-align:left;vertical-align:top;padding:9px 10px;border-bottom:1px solid var(--line)}} th{{font-weight:700}}
.tw{{overflow-x:auto}}
footer{{border-top:1px solid var(--line);padding:26px 22px;color:var(--muted);font-size:15px}}
footer .in{{max-width:1040px;margin:0 auto;display:flex;flex-wrap:wrap;gap:8px 22px}} footer a{{color:var(--muted)}}
</style>
</head>
<body>
<nav aria-label="Main"><a class="brand" href="index.html">Axencraft</a><a class="r" href="account.html">Log in</a></nav>
<main>
  <h1>{title}</h1>
  <p class="meta">Last updated {UPDATED}</p>
  <div class="box toc"><b>On this page</b><ol class="plain">{toc}</ol></div>
{body}
</main>
<footer><div class="in"><span>© Axencraft</span><a href="terms.html">Terms</a><a href="privacy.html">Privacy</a><a href="cookies.html">Cookies</a><a href="mailto:support@axencraft.co.uk">support@axencraft.co.uk</a></div></footer>
</body>
</html>
'''

WHO=f'''<p>Axencraft is the trading name of <b>{OWNER}</b>, a sole trader based in England. Our address is {ADDR}, United Kingdom. You can email us at <a href="mailto:support@axencraft.co.uk">support@axencraft.co.uk</a>. We're not VAT registered, so our prices don't include VAT.</p>'''

terms=f'''
  <p>These terms explain how our website service works and what you and we agree to. Please read them before you buy. By creating an account or paying for a plan, you accept them.</p>

  <h2 id="about">1. About us</h2>
  {WHO}

  <h2 id="service">2. Our service</h2>
  <p>Axencraft Digital Studio designs, builds and hosts websites for businesses. In short:</p>
  <ul>
    <li>You choose a plan and a style, pay the setup fee and fill in our questionnaire.</li>
    <li>We build a draft website from your answers and check it before you see it. We may use software, including AI tools, to help draft wording, and a person reviews it.</li>
    <li>You see a private preview and can ask for changes. Changes are free and unlimited while you're reviewing.</li>
    <li>When you're happy, we put your website live and host it for as long as your plan is active.</li>
  </ul>
  <p>Each plan includes a set number of pages, features and change requests a month, as described on our website when you buy. Print Studio and Grow Studio are not available yet. These terms will be updated before they open.</p>

  <h2 id="who">3. Who can use the service</h2>
  <p>Our service is for businesses, sole traders and organisations. You must be at least 18 and have authority to act for the business you're buying for. If you're buying as a consumer (for purposes outside your trade or business), you have legal rights, and nothing in these terms affects them.</p>

  <h2 id="fees">4. Prices and payment</h2>
  <ul>
    <li><b>Setup fee.</b> A one-off fee of £50, paid when you choose a plan. It covers building your website. Because we start work on your website once you've paid, the setup fee isn't refundable after we've started building, unless we can't deliver the service. If you come back to us after cancelling, and your website is still saved, you won't pay the setup fee again.</li>
    <li><b>Monthly plan.</b> Starter £19.99, Standard £39.99 or Pro £59.99 a month. You aren't charged monthly until your website goes live.</li>
    <li><b>Free trial.</b> If your plan includes a free trial, it starts on the day your website goes live, and monthly billing begins when it ends. The trial length is shown when you buy.</li>
    <li><b>Extra changes.</b> Once your website is live, changes beyond your plan's monthly allowance cost £10 each. We always ask you to confirm before adding one to your bill.</li>
    <li>Payments are taken by our payment provider, Stripe, using the card you give at checkout. Your plan renews each month until you cancel.</li>
    <li>We may change our prices. We'll give you at least 30 days' notice by email before a new price applies to you, and you can cancel before it does.</li>
  </ul>

  <h2 id="changes">5. Change requests</h2>
  <p>You can request changes from your account. Your plan includes 1, 3 or 6 changes a month after your website is live, depending on your plan. Unused changes don't carry over. A change request is a reasonable update to your existing website, such as new text, photos, opening hours or prices. A large redesign or a new feature may count as more than one change, or may need a different plan. We'll tell you before doing anything that costs extra.</p>

  <h2 id="content">6. Your content</h2>
  <ul>
    <li>You own the words, logos, photos and other material you give us ("your content").</li>
    <li>You give us permission to use, copy, edit and display your content to build, host and run your website, and to show your business name and website in our own portfolio unless you ask us not to.</li>
    <li>You confirm you have the right to use your content, and that it's accurate and lawful. Please don't send us anything you don't have permission to use, such as photos copied from other websites.</li>
    <li>If you ask us to use stock photos, we'll use images that we're licensed to use on your website.</li>
  </ul>

  <h2 id="ours">7. Our templates and software</h2>
  <p>Our templates, designs and code belong to us. While your plan is active, you may use them as part of your website. They can't be copied or used elsewhere. You can download your website's words and photos from your account at any time, including after you cancel.</p>

  <h2 id="address">8. Your website address</h2>
  <p>Your website is hosted at an address on our domain, such as <i>yourbusiness.axencraft.co.uk</i>. We choose it from your business name and can change it if you ask. If you connect your own domain name, you remain responsible for registering, renewing and paying for that domain with your domain provider.</p>

  <h2 id="messages">9. Messages from your website</h2>
  <p>Contact, booking and sign-up forms on your website send the details visitors enter to your email address. We pass these messages on and don't keep a copy of their contents. For this information you are the "controller" under data protection law, and we act as your "processor". This means:</p>
  <ul>
    <li>we only use visitors' details to deliver their messages to you, as you instruct us by using the service;</li>
    <li>anyone who handles this information for us is under a duty of confidentiality;</li>
    <li>we use appropriate security and only use the providers listed in our <a href="privacy.html">privacy policy</a>, under similar terms;</li>
    <li>we'll help you respond to requests from people exercising their rights, and tell you without undue delay if we become aware of a personal data breach affecting your website;</li>
    <li>when your plan ends, your website's forms stop working and no visitor messages are kept by us.</li>
  </ul>
  <p>You're responsible for how you use the messages you receive, and for telling your visitors how you use their details.</p>

  <h2 id="use">10. Acceptable use</h2>
  <p>You mustn't use our service for anything unlawful, misleading, hateful, harmful or that infringes someone else's rights, or to send spam. If your website breaks this rule, we may remove the content or suspend the website. Where reasonable, we'll contact you first.</p>

  <h2 id="billing">11. Failed payments, cancelling and what happens next</h2>
  <ul>
    <li><b>Failed payments.</b> If a monthly payment fails, we'll email you and Stripe will try again. If it's still unpaid 7 days after the first failure, we'll take your website offline until it's paid.</li>
    <li><b>Cancelling.</b> You can cancel at any time using Manage billing in your account. Your website stays online until the end of the period you've paid for, then goes offline. We don't refund part months.</li>
    <li><b>After it ends.</b> Your website is saved so you can come back. We keep it for up to 12 months after your plan ends, and then may delete it. You can download your words and photos from your account before then.</li>
    <li><b>Our right to end the service.</b> We may end your plan with 30 days' notice by email, or immediately if you seriously break these terms.</li>
  </ul>

  <h2 id="availability">12. Availability</h2>
  <p>We use reliable hosting and aim to keep your website online all the time, but we can't promise it will never be interrupted, for example during maintenance or problems at our providers. We'll fix problems within our control as quickly as we reasonably can.</p>

  <h2 id="liability">13. Our responsibility to you</h2>
  <ul>
    <li>We'll provide the service with reasonable care and skill.</li>
    <li>We're not responsible for losses that weren't foreseeable, for loss of profit, business or opportunity, or for problems caused by your content or events outside our reasonable control.</li>
    <li>Our total liability to you in any 12-month period is limited to the amount you paid us in that period.</li>
    <li>Nothing in these terms limits liability for death or personal injury caused by negligence, for fraud, or for anything else that can't legally be limited.</li>
  </ul>

  <h2 id="updates">14. Changes to these terms</h2>
  <p>We may update these terms. If a change affects you significantly, we'll email you at least 30 days before it applies. The date at the top shows when they last changed.</p>

  <h2 id="law">15. Law and disputes</h2>
  <p>These terms are governed by the law of England and Wales, and the courts of England and Wales have jurisdiction. If something goes wrong, please email us first at <a href="mailto:support@axencraft.co.uk">support@axencraft.co.uk</a> and we'll do our best to put it right.</p>
'''

privacy=f'''
  <p>This policy explains what personal information Axencraft collects, why, who we share it with and your rights. We keep it as short and plain as we can.</p>

  <h2 id="who">1. Who we are</h2>
  {WHO}
  <p>We are the "controller" of the personal information described here. For messages sent through our customers' websites, see section 7.</p>

  <h2 id="collect">2. What we collect</h2>
  <div class="tw"><table>
    <tr><th>Information</th><th>Why we use it</th><th>Legal basis</th></tr>
    <tr><td><b>Account details:</b> your email address and password (stored securely in scrambled form, we can't see it)</td><td>To create your account and let you log in</td><td>Contract</td></tr>
    <tr><td><b>Payment details:</b> handled by Stripe. We see your plan, payment status and the last digits of your card, never your full card number</td><td>To take payments and manage your plan</td><td>Contract; legal obligation (keeping financial records)</td></tr>
    <tr><td><b>Questionnaire answers, logo and photos</b>, including any contact details you want on your website</td><td>To build and run your website</td><td>Contract</td></tr>
    <tr><td><b>Change requests and messages</b> you send us</td><td>To make changes and help you</td><td>Contract</td></tr>
    <tr><td><b>Waitlist sign-ups:</b> name, email and which studios interest you</td><td>To tell you when Print or Grow Studio opens</td><td>Consent (you can withdraw it any time)</td></tr>
    <tr><td><b>Technical information:</b> such as your IP address and browser, recorded in server logs</td><td>To keep the service secure and working</td><td>Legitimate interests</td></tr>
  </table></div>
  <p>We don't sell your information or use it for advertising.</p>

  <h2 id="emails">3. Emails we send</h2>
  <p>We email you about your account and website, for example when your preview is ready, when your website goes live, when a change is done, before a free trial ends and if a payment fails. These are part of the service, so you can't opt out of them while you have a plan. We'll only send marketing emails if you've agreed to them.</p>

  <h2 id="share">4. Who we share it with</h2>
  <p>We use trusted providers to run our service. They only use your information to provide their service to us:</p>
  <ul>
    <li><b>Supabase</b>: our database, logins and file storage</li>
    <li><b>Vercel</b>: hosting for our website and our customers' websites</li>
    <li><b>Stripe</b>: payments and billing</li>
    <li><b>Resend</b>: sending emails</li>
    <li><b>ImprovMX</b> and <b>Google (Gmail)</b>: receiving and managing email sent to support@axencraft.co.uk</li>
    <li><b>Anthropic</b>: if we use AI to help draft website wording, your questionnaire answers may be sent to Anthropic's Claude for this purpose</li>
    <li><b>Google Fonts</b>: our pages load fonts from Google, which means your IP address is shared with Google when a page loads</li>
  </ul>
  <p>We may also share information if the law requires it, or to protect our rights.</p>

  <h2 id="transfers">5. International transfers</h2>
  <p>Some of these providers are based in, or use servers in, the United States or elsewhere outside the UK. Where this happens, we rely on legal safeguards approved under UK law, such as the UK government's adequacy regulations (including the UK-US data bridge) or the UK International Data Transfer Agreement or Addendum.</p>

  <h2 id="keep">6. How long we keep it</h2>
  <ul>
    <li><b>Your account and website:</b> while your account is active, and for up to 12 months after your plan ends so you can come back. After that we may delete your website, questionnaire answers and uploads.</li>
    <li><b>Payment and billing records:</b> 6 years, because UK tax law requires it.</li>
    <li><b>Waitlist:</b> until the studio opens and we've told you, or until you ask us to remove you.</li>
    <li><b>Server logs:</b> kept for a short time by our providers for security, usually no longer than 30 days.</li>
  </ul>

  <h2 id="sites">7. Our customers' websites</h2>
  <p>When someone fills in a contact, booking or newsletter form on a website we host for one of our customers, we pass their details to that business by email. We don't keep a copy of the message. For this information the business is the controller and we act on its behalf. If you sent a message through one of those websites, please contact that business about how it uses your details. To prevent spam, we keep a scrambled version of the sender's IP address for up to 30 days.</p>

  <h2 id="rights">8. Your rights</h2>
  <p>You have the right to:</p>
  <ul>
    <li>ask for a copy of the information we hold about you;</li>
    <li>ask us to correct or delete it;</li>
    <li>object to or ask us to restrict how we use it;</li>
    <li>ask for your information in a portable format;</li>
    <li>withdraw consent where we rely on it (such as the waitlist).</li>
  </ul>
  <p>To use any of these rights, email <a href="mailto:support@axencraft.co.uk">support@axencraft.co.uk</a>. We'll reply within one month. Some rights have limits; for example, we must keep billing records for tax purposes.</p>

  <h2 id="security">9. Keeping it safe</h2>
  <p>We use secure, encrypted connections, access controls so that customers can only see their own information, and reputable providers with strong security. Uploaded files are stored privately until they're published on your website.</p>

  <h2 id="complain">10. Complaints</h2>
  <p>If you're unhappy with how we've handled your information, please contact us first. You can also complain to the Information Commissioner's Office (ICO) at <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk/make-a-complaint</a> or on 0303 123 1113.</p>

  <h2 id="changes">11. Changes to this policy</h2>
  <p>We'll update this policy when our service changes. The date at the top shows when it last changed, and we'll email you about important changes.</p>
'''

cookies=f'''
  <p>This page explains the small amount of information our website stores in your browser. We don't use advertising or tracking cookies, so we don't need to ask for your permission with a cookie banner.</p>

  <h2 id="what">1. What we store and why</h2>
  <p>Websites can store small pieces of information in your browser using cookies or "local storage". We only store what's needed for the website to work:</p>
  <div class="tw"><table>
    <tr><th>Name</th><th>Type</th><th>What it's for</th><th>How long</th></tr>
    <tr><td>sb-…-auth-token</td><td>Local storage</td><td>Keeps you logged in to your account (Supabase)</td><td>Until you log out</td></tr>
    <tr><td>axc-plan, axc-style</td><td>Local storage</td><td>Remembers the plan and style you chose on our homepage, ready for checkout and the questionnaire</td><td>Until you pay, or clear your browser</td></tr>
    <tr><td>axc-go</td><td>Session storage</td><td>Takes you straight to payment after you create your account</td><td>Until you close the tab</td></tr>
    <tr><td>axw-q-step</td><td>Local storage</td><td>Remembers which step of the questionnaire you were on</td><td>Until you send the questionnaire</td></tr>
    <tr><td>axw-theme:…</td><td>Local storage</td><td>Remembers light or dark mode on Pro websites</td><td>Until you clear your browser</td></tr>
  </table></div>
  <p>These are "strictly necessary" for the features you use, so the law doesn't require consent for them.</p>

  <h2 id="others">2. Other companies</h2>
  <ul>
    <li><b>Stripe</b> sets its own cookies on its secure checkout and billing pages to process payments and prevent fraud. See <a href="https://stripe.com/cookie-settings">Stripe's cookie information</a>.</li>
    <li><b>Google Fonts</b> provides the fonts on our pages. Google receives your IP address when fonts load, but doesn't set cookies for this.</li>
  </ul>

  <h2 id="control">3. Controlling storage</h2>
  <p>You can clear or block cookies and local storage in your browser settings. If you do, you'll be logged out and may need to choose your plan or style again.</p>

  <h2 id="changes">4. Changes</h2>
  <p>If we ever add analytics or anything that isn't strictly necessary, we'll update this page and ask for your consent first where the law requires it.</p>
'''
import sys
out=sys.argv[1]
for slug,t,d,b in [('terms','Terms of service','The terms for using Axencraft Digital Studio website design and hosting.',terms),
                   ('privacy','Privacy policy','How Axencraft collects, uses and protects your personal information.',privacy),
                   ('cookies','Cookie notice','The small amount of information the Axencraft website stores in your browser.',cookies)]:
    open(f'{out}/{slug}.html','w').write(page(slug,t,d,b))
print('built')
