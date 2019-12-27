export type Thread = {
    readonly worker: Worker;
    state: 'running' | 'idle';
    threadOpts: ThreadRunOptions | undefined;
    _threadReceiveMsg: (e: MessageEvent) => void;
    run<T extends (...args: any[]) => any>(
        this: Thread,
        func: T,
        ...args: Parameters<T>
    ): Promise<ReturnType<T>>;
};

export type ThreadRunOptions = {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
};

const workerMain = `function() {
    onmessage = function (ev) {
        const msg = ev.data;

        const args = Object.keys(msg)
            .filter(key => key.match(/^argument/))
            .sort((a, b) => parseInt(a.slice(8), 10) - parseInt(b.slice(8), 10))
            .map(key => msg[key]);

        try {
            const result = eval('(' + msg.func + ')').apply(undefined, args);
            self.postMessage(result);
        } catch (e) {
            self.postMessage(e.stack);
        }
    }
};`

export const Thread = (): Thread => {
    const worker = new Worker(fnToURL(workerMain));

    const thread: Thread = {
        state: 'idle',

        worker,

        threadOpts: undefined,

        _threadReceiveMsg: function (this: Thread, e: MessageEvent) {
            const msg = e.data;
            this.state = 'idle';
            console.log(this, msg);
            if (msg)
                this.threadOpts?.resolve(msg);
            else
                this.threadOpts?.reject('No data returned');
        },

        run: function (func, ...args): Promise<ReturnType<typeof func>> {
            if (this.state === 'running')
                throw Error('Thread is already in a running state.'); // todo: queue up stuff?

            const obj: any = { func: func.toString() };
            args.forEach((arg, i) => obj['argument' + i] = arg);
            return new Promise((resolve, reject) => {
                this.threadOpts = { resolve, reject };
                this.state = 'running'
                this.worker.postMessage(obj);
            });
        }
    };

    worker.addEventListener('message', thread._threadReceiveMsg.bind(thread));
    return thread;
};

const fnToURL = (func: Function | string) => {
    const strFn: string = func.toString();
    const fnBody: string = strFn
        .substring(
            strFn.indexOf('{') + 1,
            strFn.lastIndexOf('}')
        );

    const blob = new Blob(
        [fnBody], {
            type: 'text/javascript'
        });

    return URL.createObjectURL(blob);
}
