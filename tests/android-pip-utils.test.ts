import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAndroidPiPTransitionPlan,
  shouldRestoreInlineAfterAndroidPiP,
  shouldRollbackTemporaryWindowFullscreen,
} from '@/components/player/hooks/desktop/android-pip-utils';

test('inline playback enters temporary window fullscreen and restores inline after PiP closes', () => {
  const plan = createAndroidPiPTransitionPlan('none');

  assert.deepEqual(plan, {
    enterTemporaryWindowFullscreen: true,
    restoreInlineOnExit: true,
  });

  assert.equal(
    shouldRestoreInlineAfterAndroidPiP({
      enteredTemporaryWindowFullscreen: plan.enterTemporaryWindowFullscreen,
      restoreInlineOnExit: plan.restoreInlineOnExit,
    }, false),
    true
  );
});

test('existing page fullscreen stays in page fullscreen after PiP closes', () => {
  const plan = createAndroidPiPTransitionPlan('window');

  assert.deepEqual(plan, {
    enterTemporaryWindowFullscreen: false,
    restoreInlineOnExit: false,
  });

  assert.equal(
    shouldRestoreInlineAfterAndroidPiP({
      enteredTemporaryWindowFullscreen: plan.enterTemporaryWindowFullscreen,
      restoreInlineOnExit: plan.restoreInlineOnExit,
    }, false),
    false
  );
});

test('system fullscreen also restores inline after PiP closes', () => {
  const plan = createAndroidPiPTransitionPlan('native');

  assert.deepEqual(plan, {
    enterTemporaryWindowFullscreen: true,
    restoreInlineOnExit: true,
  });

  assert.equal(
    shouldRestoreInlineAfterAndroidPiP({
      enteredTemporaryWindowFullscreen: plan.enterTemporaryWindowFullscreen,
      restoreInlineOnExit: plan.restoreInlineOnExit,
    }, false),
    true
  );
});

test('temporary page fullscreen rolls back when Android PiP entry fails', () => {
  assert.equal(
    shouldRollbackTemporaryWindowFullscreen({
      enteredTemporaryWindowFullscreen: true,
      restoreInlineOnExit: true,
    }),
    true
  );

  assert.equal(
    shouldRollbackTemporaryWindowFullscreen({
      enteredTemporaryWindowFullscreen: false,
      restoreInlineOnExit: false,
    }),
    false
  );
});
