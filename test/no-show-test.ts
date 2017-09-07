import Task, { isCancelation } from 'no-show';

QUnit.module('Task');

QUnit.test('Running a basic task', async assert => {
  let step = 0;

  let task = new Task(async () => {
    assert.equal(++step, 1, '1. Before return');
    return 'it works';
  });

  assert.equal(step, 1, 'Task should be sync');

  assert.deepEqual(getState(task), {
    isRunning: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'Running');

  let value = await task;

  assert.equal(step, 1);

  assert.deepEqual(getState(task), {
    isRunning: false,
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
  let step = 0;

  let task = new Task(async () => {
    assert.equal(++step, 1, '1. Before throw');
    throw new Error('zomg');
  });

  assert.equal(step, 1, 'Task should be sync');

  assert.deepEqual(getState(task), {
    isRunning: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'Running');

  try {
    await task;
    assert.ok(false, 'This should not be reached');
  } catch (error) {
    assert.equal(step, 1);

    assert.deepEqual(getState(task), {
      isRunning: false,
      isDone: true,
      isSuccessful: false,
      isError: true,
      isCanceled: false
    }, 'Error');

    assert.notOk(isCancelation(error), 'Should not throw a CancelationError');
    assert.equal(error.message, 'zomg');
    assert.equal(task.error.message, 'zomg');
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
  let step = 0;

  let task = new Task(async () => {
    assert.equal(++step, 1, '1. before return');
  });

  assert.equal(step, 1, 'Task should be sync');

  assert.deepEqual(getState(task), {
    isRunning: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'Running');

  task.cancel('because reason');

  assert.deepEqual(getState(task), {
    isRunning: false,
    isDone: true,
    isSuccessful: false,
    isError: false,
    isCanceled: true
  }, 'Canceled');

  try {
    await task;
    assert.ok(false, 'This should not be reached');
  } catch (error) {
    assert.equal(step, 1);

    assert.deepEqual(getState(task), {
      isRunning: false,
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
    assert.equal(++step, 1, '1. Before un-interruptable await');

    await taskBarrier.wait();

    assert.equal(++step, 2, '2. Before interruptable await');

    testBarrier.signal();

    await run(null);

    assert.ok(false, 'This should not be reached');
  });

  assert.equal(step, 1, 'Task should be sync');

  assert.deepEqual(getState(task), {
    isRunning: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'Running');

  task.cancel();

  assert.deepEqual(getState(task), {
    isRunning: false,
    isDone: true,
    isSuccessful: false,
    isError: false,
    isCanceled: true
  }, 'Canceled');

  taskBarrier.signal();
  await testBarrier.wait();

  assert.equal(step, 2);

  assert.deepEqual(getState(task), {
    isRunning: false,
    isDone: true,
    isSuccessful: false,
    isError: false,
    isCanceled: true
  }, 'Canceled');

  try {
    await task;
    assert.ok(false, 'This should not be reached');
  } catch (error) {
    assert.equal(step, 2);

    assert.deepEqual(getState(task), {
      isRunning: false,
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
});

QUnit.test('Can link tasks', async assert => {
  let a = new Task(async run => {
    await run(null);
    assert.ok(false, 'This should not be reached');
  });

  let b = new Task(async run => {
    await run(null);
    assert.ok(false, 'This should not be reached');
  });

  let c = new Task(async run => {
    await run(null);
    return 'c';
  });

  b.link(a);

  assert.deepEqual(getState(a), {
    isRunning: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'a: Running');

  assert.deepEqual(getState(b), {
    isRunning: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'b: Running');

  assert.deepEqual(getState(c), {
    isRunning: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'c: Running');

  a.cancel();

  assert.deepEqual(getState(a), {
    isRunning: false,
    isDone: true,
    isSuccessful: false,
    isError: false,
    isCanceled: true
  }, 'a: Canceled');

  assert.deepEqual(getState(b), {
    isRunning: false,
    isDone: true,
    isSuccessful: false,
    isError: false,
    isCanceled: true
  }, 'b: Canceled');

  assert.deepEqual(getState(c), {
    isRunning: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'c: Running');

  try {
    await a;
    assert.ok(false, 'This should not be reached');
  } catch (error) {
    assert.deepEqual(getState(a), {
      isRunning: false,
      isDone: true,
      isSuccessful: false,
      isError: false,
      isCanceled: true
    }, 'a: Canceled');
  }

  try {
    await b;
    assert.ok(false, 'This should not be reached');
  } catch (error) {
    assert.deepEqual(getState(a), {
      isRunning: false,
      isDone: true,
      isSuccessful: false,
      isError: false,
      isCanceled: true
    }, 'b: Canceled');
  }

  assert.equal(await c, 'c', 'Unlinked task is not canceled');

  assert.deepEqual(getState(c), {
    isRunning: false,
    isDone: true,
    isSuccessful: true,
    isError: false,
    isCanceled: false
  }, 'c: Successful');
});

QUnit.test('Can link tasks via run.linked', async assert => {
  let step = 0;
  let taskBarrier = new Semaphore();

  // These should be synchronously assigned below.
  // This is a hack to get TS to believe it.
  let childLinked: Task<void> = null as any;
  let childUnlinked: Task<string> = null as any;

  let parent = new Task(async run => {
    assert.equal(++step, 1, '1. Before run.*');

    childLinked = new Task(async runInner => {
      assert.equal(++step, 2, '2. Inside run.linked');
      await runInner(taskBarrier.wait());
      assert.ok(false, 'This should not be reached');
    });

    childUnlinked = new Task(async runInner => {
      assert.equal(++step, 3, '3. Inside run (unlinked)');
      await runInner(taskBarrier.wait());
      assert.equal(++step, 4, '4. Returning from run (unlinked)');
      return 'childUnlinked';
    });

    await Promise.all([
      run.linked(childLinked),
      run(childUnlinked) // unlinked
    ]);

    assert.ok(false, 'This should not be reached');
  });

  assert.equal(step, 3, 'Tasks should be sync');

  assert.deepEqual(getState(parent), {
    isRunning: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'parent: Running');

  assert.deepEqual(getState(childLinked), {
    isRunning: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'childLinked: Running');

  assert.deepEqual(getState(childUnlinked), {
    isRunning: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'childUnlinked: Running');

  parent.cancel();

  assert.deepEqual(getState(parent), {
    isRunning: false,
    isDone: true,
    isSuccessful: false,
    isError: false,
    isCanceled: true
  }, 'parent: Canceled');

  assert.deepEqual(getState(childLinked), {
    isRunning: false,
    isDone: true,
    isSuccessful: false,
    isError: false,
    isCanceled: true
  }, 'childLinked: Canceled');

  assert.deepEqual(getState(childUnlinked), {
    isRunning: true,
    isDone: false,
    isSuccessful: false,
    isError: false,
    isCanceled: false
  }, 'childUnlinked: Running');

  taskBarrier.signalAll();

  try {
    await parent;
    assert.ok(false, 'This should not be reached');
  } catch (error) {
    assert.deepEqual(getState(parent), {
      isRunning: false,
      isDone: true,
      isSuccessful: false,
      isError: false,
      isCanceled: true
    }, 'parent: Canceled');
  }

  try {
    await childLinked;
    assert.ok(false, 'This should not be reached');
  } catch (error) {
    assert.deepEqual(getState(childLinked), {
      isRunning: false,
      isDone: true,
      isSuccessful: false,
      isError: false,
      isCanceled: true
    }, 'childLinked: Canceled');
  }

  assert.equal(await childUnlinked, 'childUnlinked', 'Unlinked task is not canceled');

  assert.deepEqual(getState(childUnlinked!), {
    isRunning: false,
    isDone: true,
    isSuccessful: true,
    isError: false,
    isCanceled: false
  }, 'childUnlinked: Successful');
});

function getState(task: Task<any>) {
  return {
    isRunning: task.isRunning,
    isDone: task.isDone,
    isSuccessful: task.isSuccessful,
    isError: task.isError,
    isCanceled: task.isCanceled
  };
}

class Semaphore {
  private waiters: Array<() => void> = [];

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
