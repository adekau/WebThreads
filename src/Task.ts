export interface ITaskOptions<T> {
    /**
     * Task id, used for keeping track of tasks in a thread pool.
     */
    id: number;

    /**
     * Function to execute when `Task.run` is called.
     */
    func: T | string;
};

/**
 * A deferred computation that can be run asynchronously or in parallel on a thread.
 * @param opts The options to use on Task creation.
 */
export class Task<T extends (...args: any[]) => any> implements ITaskOptions<T> {
    private _promise: Promise<ReturnType<T>>;
    /**
     * Completes the task with a value.
     * @param value the value to complete the task with.
     */
    public resolve: (value?: ReturnType<T> | PromiseLike<ReturnType<T>> | undefined) => void;
    /**
     * Fails the task with a reason.
     * @param reason an explanation of why the task failed.
     */
    public reject: (reason?: unknown) => void;
    public id: number;
    public func: T | string;
    public state: 'todo' | 'running' | 'done' | 'error';
    public startTime: Date | undefined;

    constructor(opts: ITaskOptions<T>) {
        this.id = opts.id;
        this.func = opts.func;
        this._promise = new Promise((resolve, reject) => {
            this.resolve = (value?: ReturnType<T> | PromiseLike<ReturnType<T>> | undefined) => {
                this.state = 'done';
                resolve(value);
            };

            this.reject = (reason?: unknown) => {
                this.state = 'error';
                reject(reason);
            };
        });
        this.state = 'todo';
        this.startTime = undefined;
    }

    /**
     * Runs the task.
     * @param args Arguments to run the task's function with.
     * @returns Promise<T>
     */
    public run(...args: Parameters<T>): Promise<T> {
        this.state = 'running';
        this.startTime = new Date();

        try {
            const result = typeof this.func === 'function'
                ? this.func(...args)
                : eval(`(${this.func})`);

            this.state = 'done';
            this.resolve(result);
        } catch (e) {
            this.state = 'error';
            this.reject(e);
        }
        return this.done();
    }

    /**
     * Returns a promise that completes when the task is done, or fails when the task fails.
     * @returns Promise<T>
     */
    public async done(): Promise<ReturnType<T>> {
        return this._promise
            .then((v: ReturnType<T>) => (this.state = 'done', v))
            .catch((e: any) => {
                this.state = 'error';
                throw e;
            });
    }
};
