export interface ITaskOptions<T> {
    id: number;
    func: T | string;
};

export class Task<T extends (...args: any[]) => any> implements ITaskOptions<T> {
    private _promise: Promise<T>;
    public resolve: (value: T) => void;
    public reject: (reason: unknown) => void;
    public id: number;
    public func: T | string;
    public state: 'todo' | 'running' | 'done' | 'error';
    public startTime: Date | undefined;

    constructor(opts: ITaskOptions<T>) {
        this.id = opts.id;
        this.func = opts.func;
        this._promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
        this.state = 'todo';
        this.startTime = undefined;
    }

    public run(...args: Parameters<T>): Promise<T> {
        this.state = 'running';
        try {
            const result = typeof this.func === 'function' ? this.func(...args) : eval(`(${this.func})`);
            this.state = 'done';
            this.resolve(result);

        } catch (e) {
            this.state = 'error';
            this.reject(e);
        }
        return this.done();
    }

    public async done() {
        return this._promise.then((v: T) => {
            this.state = 'done';
            return v;
        }).catch((e: any) => {
            this.state = 'error';
            throw e;
        });
    }
};

