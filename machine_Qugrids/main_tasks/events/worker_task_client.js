const os = require('os');
const path = require('path');
const { Worker } = require('worker_threads');

class WorkerTaskClient {
    constructor(workerFilename, workerData = {}, options = {}) {
        this.worker_filename = workerFilename;
        this.worker_data = workerData;
        this.ordered = options.ordered !== false;
        this.pool_size = WorkerTaskClient.normalizePoolSize(options.poolSize);
        this.worker_states = [];
        this.next_worker_index = 0;
        this.next_sequence = 1;
        this.next_delivery_sequence = 1;
        this.completed_tasks = new Map();

        for (let index = 0; index < this.pool_size; index++) {
            this.worker_states.push(this.createWorkerState(index));
        }
    }

    static normalizePoolSize(value) {
        const parsed_value = Number(value);
        if (Number.isInteger(parsed_value) && parsed_value > 0) {
            return parsed_value;
        }
        return 1;
    }

    static resolvePoolSize(...envNames) {
        for (const env_name of envNames) {
            const parsed_value = Number(process.env[env_name]);
            if (Number.isInteger(parsed_value) && parsed_value > 0) {
                return parsed_value;
            }
        }

        const shared_pool_size = Number(
            process.env.MACHINE_QUGRIDS_CRYPTO_WORKERS ??
            process.env.MACHINE_QUGRIDS_WORKER_POOL_SIZE
        );
        if (Number.isInteger(shared_pool_size) && shared_pool_size > 0) {
            return shared_pool_size;
        }

        const cpu_count =
            typeof os.availableParallelism === 'function'
                ? os.availableParallelism()
                : os.cpus().length;
        return cpu_count >= 4 ? 2 : 1;
    }

    createWorkerState(slot) {
        const worker_state = {
            slot,
            worker: new Worker(path.join(__dirname, this.worker_filename), {
                workerData: this.worker_data
            }),
            pending_tasks: new Map(),
            next_task_id: 1
        };

        worker_state.worker.on('message', (message) => {
            this.handleWorkerMessage(worker_state, message);
        });

        worker_state.worker.on('error', (error) => {
            this.handleWorkerFailure(worker_state, error);
        });

        worker_state.worker.on('exit', (code) => {
            if (code === 0) {
                return;
            }
            this.handleWorkerFailure(worker_state, new Error(`Worker exited with code ${code}`));
        });

        return worker_state;
    }

    handleWorkerMessage(worker_state, message) {
        if (message == undefined || typeof message !== 'object') {
            return;
        }
        const pending_task = worker_state.pending_tasks.get(message.id);
        if (pending_task == undefined) {
            return;
        }
        worker_state.pending_tasks.delete(message.id);
        if (message.ok === true) {
            this.completeTask(pending_task, {
                ok: true,
                result: message.result
            });
            return;
        }
        this.completeTask(pending_task, {
            ok: false,
            error: new Error(message.error ?? 'Worker task failed')
        });
    }

    handleWorkerFailure(worker_state, error) {
        if (this.worker_states[worker_state.slot] !== worker_state) {
            return;
        }
        for (const pending_task of worker_state.pending_tasks.values()) {
            this.completeTask(pending_task, {
                ok: false,
                error
            });
        }
        worker_state.pending_tasks.clear();
        this.worker_states[worker_state.slot] = this.createWorkerState(worker_state.slot);
    }

    completeTask(task_entry, outcome) {
        if (this.ordered !== true) {
            if (outcome.ok === true) {
                task_entry.resolve(outcome.result);
            } else {
                task_entry.reject(outcome.error);
            }
            return;
        }
        this.completed_tasks.set(task_entry.sequence, {
            task_entry,
            outcome
        });
        this.flushCompletedTasks();
    }

    flushCompletedTasks() {
        while (this.completed_tasks.has(this.next_delivery_sequence)) {
            const completed_task = this.completed_tasks.get(this.next_delivery_sequence);
            this.completed_tasks.delete(this.next_delivery_sequence);
            this.next_delivery_sequence += 1;

            if (completed_task.outcome.ok === true) {
                completed_task.task_entry.resolve(completed_task.outcome.result);
            } else {
                completed_task.task_entry.reject(completed_task.outcome.error);
            }
        }
    }

    run(type, payload) {
        return new Promise((resolve, reject) => {
            const worker_state = this.worker_states[this.next_worker_index];
            this.next_worker_index = (this.next_worker_index + 1) % this.worker_states.length;

            const task_id = worker_state.next_task_id++;
            const task_entry = {
                sequence: this.next_sequence++,
                resolve,
                reject
            };
            worker_state.pending_tasks.set(task_id, task_entry);

            try {
                worker_state.worker.postMessage({
                    id: task_id,
                    type,
                    payload
                });
            } catch (error) {
                worker_state.pending_tasks.delete(task_id);
                this.handleWorkerFailure(worker_state, error);
            }
        });
    }
}

module.exports = WorkerTaskClient;
