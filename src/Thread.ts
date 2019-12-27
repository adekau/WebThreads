export type Thread = {
    readonly worker: Worker;
    state: 'running' | 'idle';
    _threadReceiveMsg: (e: MessageEvent) => void;
    run<T extends (...args: any[]) => any>(this: Thread, func: T, ...args: Parameters<T>): any;
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

        _threadReceiveMsg: function (e: MessageEvent) {
            const msg = e.data;
            this.state = 'idle';
            console.log(msg);
        },

        run: function (func, ...args) {
            if (this.state === 'running')
                return; // todo: queue up stuff?

            const obj: any = { func: func.toString() };
            args.forEach((arg, i) => obj['argument' + i] = arg);
            this.state = 'running'
            this.worker.postMessage(obj);
        }
    };

    worker.addEventListener('message', thread._threadReceiveMsg);
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
