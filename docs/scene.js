/* The demo scene, driven in-page while record.cjs captures it.
 *
 * Kept under three minutes because judges are not required to watch past that.
 * Beats, in order: the idea -> it triages -> it holds -> the batch lands ->
 * night refuses -> the ceiling refuses. The refusals are the point, so they get
 * the most screen time.
 *
 * Run:  node tools/record.cjs --url http://localhost:7817 \
 *         --script agents/Naseeb/nebius/vigil/docs/scene.js \
 *         --width 1600 --height 900 --fps 12 --out vigil-demo.webm
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);

/* A caption bar, injected so the video reads without narration. */
function captionBar() {
  const bar = document.createElement('div');
  bar.id = 'cap';
  bar.style.cssText = [
    'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:9999',
    'background:rgba(8,10,13,.94)', 'color:#e6eaf0',
    'font:500 19px/1.45 ui-sans-serif,system-ui,sans-serif',
    'padding:16px 26px', 'text-align:center',
    'border-top:1px solid #242b35', 'letter-spacing:.005em',
    'transition:opacity .25s', 'opacity:0',
  ].join(';');
  document.body.appendChild(bar);
  return bar;
}

const bar = captionBar();
const say = async (text, hold = 2600) => {
  bar.style.opacity = '0';
  await sleep(220);
  bar.textContent = text;
  bar.style.opacity = '1';
  await sleep(hold);
};

const log = [];

await sleep(900);

  // 1 - the claim
  await say('Vigil: an always-on personal agent that is not an always-on interruption.', 3200);
  await say('Most agents are built to do more. The reason people mute them is that they do too much to you.', 4200);

  // 2 - set a working afternoon and let it triage
  $('.clock-actions [data-hour="18"]').click();
  await sleep(900);
  await say('Eight items arrive. Nemotron on Nebius Token Factory sorts each one: act, hold, or refuse.', 4000);

  $('#runAll').click();
  await sleep(1500);
  await say('Routine notices it handles alone. They never cost you a glance.', 3600);
  await sleep(4500);

  log.push('verdicts: ' + [...document.querySelectorAll('#inbox .verdict')].map((v) => v.textContent).join(','));

  // 3 - the refusals, which are the actual argument
  await say('A crypto offer promising guaranteed returns is refused outright. No workaround is proposed.', 4200);
  await say('An item telling the agent to ignore its rules is data, not instructions. That attempt is the reason to refuse it.', 4600);
  await say('The model proposes. The rules it must not override are re-checked in code afterwards.', 4200);

  // 4 - what is held, and why
  await say('What is left is what genuinely needs you. It waits - it does not interrupt.', 3800);
  await sleep(1200);
  await say('And it remembers: a stored preference about suppliers is what shaped that verdict.', 3800);

  // 5 - the batch
  $('#openWindow').click();
  await sleep(1400);
  await say('At the window, everything arrives at once. One batch, one line each.', 4000);
  await sleep(1800);

  // 6 - night, the part with no exceptions
  $('.clock-actions [data-hour="22"]').click();
  await sleep(1000);
  $('#runAll').click();
  await sleep(4000);
  await say('22:00. New items are still triaged - the agent keeps working.', 3600);
  $('#openWindow').click();
  await sleep(900);
  await say('But nothing goes out. Quiet hours are absolute, and the queue stays intact until 07:00.', 4400);
  log.push('night queue held: ' + $('#queueCount').textContent);

  // 7 - the ceiling
  const f = $('#spendForm');
  f.querySelector('[name=amount]').value = '2000';
  f.querySelector('[name=purpose]').value = 'ad test';
  f.querySelector('[name=expectedReturn]').value = '';
  f.requestSubmit();
  await sleep(1400);
  await say('And it cannot spend. A cost with no expected return is not a proposal.', 4200);
  await sleep(1000);

  // 8 - close
  await say('Three disciplines: fixed windows, durable memory, a ceiling enforced in code.', 4000);
  await say('Built on Nebius Token Factory with NVIDIA Nemotron. Zero dependencies - clone it and run node server.cjs.', 4600);
  bar.style.opacity = '0';
  await sleep(1200);

  return log.join(' | ');
