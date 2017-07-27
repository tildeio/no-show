import Task, { isCancelation } from '../src';

QUnit.module('Task');

QUnit.test('Running a basic task', async assert => {
  let task = new Task(async run => 'it works');

  assert.deepEqual(getState(task), {
    isScheduled: true,
    isRunning: false,
    isPending: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'Scheduled');

  let value = await task;

  assert.deepEqual(getState(task), {
    isScheduled: false,
    isRunning: false,
    isPending: false,
    isDone: true,
    isSuccessful: true,
    isError: false,
    isCanceled: false
  }, 'Successful');

  assert.equal(value, 'it works');
  assert.equal(task.value, 'it works');
  assert.throws(() => task.error);
  assert.throws(() => task.reason);
});

QUnit.test('Running a basic task that throws', async assert => {
  let task = new Task(async run => { throw 'zomg'; });

  assert.deepEqual(getState(task), {
    isScheduled: true,
    isRunning: false,
    isPending: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'Scheduled');

  try {
    await task;
    assert.ok(false, 'This should not be reached');
  } catch(error) {
    assert.deepEqual(getState(task), {
      isScheduled: false,
      isRunning: false,
      isPending: false,
      isDone: true,
      isSuccessful: false,
      isError: true,
      isCanceled: false
    }, 'Error');

    assert.notOk(isCancelation(error), 'Should not throw a CancelationError');
    assert.equal(error, 'zomg');
    assert.equal(task.error, 'zomg');
    assert.throws(() => task.value);
    assert.throws(() => task.reason);
  }
});

QUnit.test('Can await other runnables', async assert => {
  let task = new Task(async run => {
    assert.equal(await run('hello'), 'hello');

    assert.equal(await run(Promise.resolve('world')), 'world');

    return run('bye!');
  });

  assert.equal(await task, 'bye!');
});

QUnit.test('Can cancel immediately', async assert => {
  let task = new Task(async run => {
    assert.ok(false, 'This should not be reached');
  });

  assert.deepEqual(getState(task), {
    isScheduled: true,
    isRunning: false,
    isPending: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'Scheduled');

  task.cancel('because reason');

  assert.deepEqual(getState(task), {
    isScheduled: false,
    isRunning: false,
    isPending: false,
    isDone: true,
    isSuccessful: false,
    isError: false,
    isCanceled: true
  }, 'Canceled');

  try {
    await task;
    assert.ok(false, 'This should not be reached');
  } catch(error) {
    assert.deepEqual(getState(task), {
      isScheduled: false,
      isRunning: false,
      isPending: false,
      isDone: true,
      isSuccessful: false,
      isError: false,
      isCanceled: true
    }, 'Canceled');

    assert.ok(isCancelation(error), 'Should throw a CancelationError');
    assert.equal(error.message, 'Task canceled: because reason');
    assert.equal(error.reason, 'because reason');
    assert.throws(() => task.value);
    assert.throws(() => task.error);
  }
});

QUnit.test('Can cancel after making some progress', async assert => {
  let step = 0;
  let taskBarrier = new Semaphore();
  let testBarrier = new Semaphore();

  let task = new Task(async run => {
    assert.ok(++step, '1. Before un-interruptable await');

    testBarrier.signal();
    await taskBarrier.wait();

    assert.ok(++step, '2. Before interruptable await');

    testBarrier.signal();
    await run(taskBarrier.wait());

    assert.ok(false, 'This should not be reached');
  });

  assert.strictEqual(step, 0);

  assert.deepEqual(getState(task), {
    isScheduled: true,
    isRunning: false,
    isPending: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'Scheduled');

  await testBarrier.wait();

  assert.deepEqual(getState(task), {
    isScheduled: false,
    isRunning: true,
    isPending: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'Running');

  assert.equal(step, 1);

  task.cancel();

  try {
    await task;
    assert.ok(false, 'This should not be reached');
  } catch(error) {
    assert.equal(step, 1);

    assert.deepEqual(getState(task), {
      isScheduled: false,
      isRunning: false,
      isPending: false,
      isDone: true,
      isSuccessful: false,
      isError: false,
      isCanceled: true
    }, 'Canceled');

    assert.ok(isCancelation(error), 'Should throw a CancelationError');
    assert.equal(error.message, 'Task canceled.');
    assert.strictEqual(error.reason, null);
    assert.strictEqual(task.reason, null);
    assert.throws(() => task.value);
    assert.throws(() => task.error);
  }

  taskBarrier.signal();

  await testBarrier.wait();

  assert.equal(step, 2);

  assert.deepEqual(getState(task), {
    isScheduled: false,
    isRunning: false,
    isPending: false,
    isDone: true,
    isSuccessful: false,
    isError: false,
    isCanceled: true
  }, 'Canceled');
});

QUnit.test('Can link tasks', async assert => {
  let a = new Task(async run => {
    assert.ok(false, 'This should not be reached');
  });

  let b = new Task(async run => {
    assert.ok(false, 'This should not be reached');
  });

  let c = new Task(async run => {
    return 'c';
  });

  b.link(a);

  assert.deepEqual(getState(a), {
    isScheduled: true,
    isRunning: false,
    isPending: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'a: Scheduled');

  assert.deepEqual(getState(b), {
    isScheduled: true,
    isRunning: false,
    isPending: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'b: Scheduled');

  assert.deepEqual(getState(c), {
    isScheduled: true,
    isRunning: false,
    isPending: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'c: Scheduled');

  a.cancel();

  assert.deepEqual(getState(a), {
    isScheduled: false,
    isRunning: false,
    isPending: false,
    isDone: true,
    isSuccessful: false,
    isError: false,
    isCanceled: true
  }, 'a: Canceled');

  assert.deepEqual(getState(b), {
    isScheduled: false,
    isRunning: false,
    isPending: false,
    isDone: true,
    isSuccessful: false,
    isError: false,
    isCanceled: true
  }, 'b: Canceled');

  assert.deepEqual(getState(c), {
    isScheduled: true,
    isRunning: false,
    isPending: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'c: Scheduled');

  try {
    await a;
    assert.ok(false, 'This should not be reached');
  } catch(error) {
    assert.deepEqual(getState(a), {
      isScheduled: false,
      isRunning: false,
      isPending: false,
      isDone: true,
      isSuccessful: false,
      isError: false,
      isCanceled: true
    }, 'a: Canceled');
  }

  try {
    await b;
    assert.ok(false, 'This should not be reached');
  } catch(error) {
    assert.deepEqual(getState(a), {
      isScheduled: false,
      isRunning: false,
      isPending: false,
      isDone: true,
      isSuccessful: false,
      isError: false,
      isCanceled: true
    }, 'b: Canceled');
  }

  assert.equal(await c, 'c', 'Unlinked task is not canceled');

  assert.deepEqual(getState(c), {
    isScheduled: false,
    isRunning: false,
    isPending: false,
    isDone: true,
    isSuccessful: true,
    isError: false,
    isCanceled: false
  }, 'c: Successful');
});

QUnit.test('Can link tasks via run.linked', async assert => {
  let step = 0;
  let taskBarrier = new Semaphore();
  let testBarrier = new Semaphore();

  let a = new Task(async run => {
    assert.ok(++step, '1. Before run.*');

    testBarrier.signal();
    await taskBarrier.wait();

    b = new Task(async run => {
      assert.ok(++step, '2. Inside run.linked');
      testBarrier.signal();
      await run(taskBarrier.wait());
      assert.ok(false, 'This should not be reached');
    });

    c = new Task(async run => {
      assert.ok(++step, '3. Inside run (unlinked)');
      testBarrier.signal();
      await run(taskBarrier.wait());
      return 'c';
    });

    await Promise.all([
      run.linked(b),
      run(c)
    ]);

    assert.ok(false, 'This should not be reached');
  });

  let b: Task<void> | null = null;
  let c: Task<string> | null = null;

  assert.strictEqual(step, 0);

  assert.deepEqual(getState(a), {
    isScheduled: true,
    isRunning: false,
    isPending: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'a: Scheduled');

  assert.strictEqual(b!, null);
  assert.strictEqual(c!, null);

  await testBarrier.wait();

  assert.equal(step, 1);

  assert.deepEqual(getState(a), {
    isScheduled: false,
    isRunning: true,
    isPending: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'a: Running');

  assert.strictEqual(b!, null);
  assert.strictEqual(c!, null);

  taskBarrier.signal();
  await testBarrier.wait();
  await testBarrier.wait();

  assert.equal(step, 3);

  assert.deepEqual(getState(a), {
    isScheduled: false,
    isRunning: true,
    isPending: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'a: Running');

  assert.deepEqual(getState(b!), {
    isScheduled: false,
    isRunning: true,
    isPending: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'b: Running');

  assert.deepEqual(getState(c!), {
    isScheduled: false,
    isRunning: true,
    isPending: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'c: Running');

  a.cancel();

  assert.deepEqual(getState(a), {
    isScheduled: false,
    isRunning: false,
    isPending: false,
    isDone: true,
    isSuccessful: false,
    isError: false,
    isCanceled: true
  }, 'a: Canceled');

  assert.deepEqual(getState(b!), {
    isScheduled: false,
    isRunning: false,
    isPending: false,
    isDone: true,
    isSuccessful: false,
    isError: false,
    isCanceled: true
  }, 'b: Canceled');

  assert.deepEqual(getState(c!), {
    isScheduled: false,
    isRunning: true,
    isPending: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'c: Running');

  try {
    await a;
    assert.ok(false, 'This should not be reached');
  } catch(error) {
    assert.deepEqual(getState(a), {
      isScheduled: false,
      isRunning: false,
      isPending: false,
      isDone: true,
      isSuccessful: false,
      isError: false,
      isCanceled: true
    }, 'a: Canceled');
  }

  try {
    await b;
    assert.ok(false, 'This should not be reached');
  } catch(error) {
    assert.deepEqual(getState(b!), {
      isScheduled: false,
      isRunning: false,
      isPending: false,
      isDone: true,
      isSuccessful: false,
      isError: false,
      isCanceled: true
    }, 'b: Canceled');
  }

  taskBarrier.signalAll();

  assert.equal(await c, 'c', 'Unlinked task is not canceled');

  assert.deepEqual(getState(c!), {
    isScheduled: false,
    isRunning: false,
    isPending: false,
    isDone: true,
    isSuccessful: true,
    isError: false,
    isCanceled: false
  }, 'c: Successful');
});

function getState(task: Task<any>) {
  return {
    isScheduled: task.isScheduled,
    isRunning: task.isRunning,
    isPending: task.isPending,
    isDone: task.isDone,
    isSuccessful: task.isSuccessful,
    isError: task.isError,
    isCanceled: task.isCanceled
  };
}

class Semaphore {
  private waiters: (() => void)[] = [];

  constructor(private value = 0) {
  }

  wait(): Promise<void> {
    if (--this.value >= 0) {
      return Promise.resolve();
    } else {
      return new Promise(resolve => {
        this.waiters.push(resolve);
      });
    }
  }

  signal(): void {
    ++this.value;

    let waiter = this.waiters.pop();

    if (waiter) {
      waiter();
    }
  }

  signalAll(): void {
    this.value = 0;
    this.waiters.forEach(waiter => waiter());
    this.waiters.length = 0;
  }
}
