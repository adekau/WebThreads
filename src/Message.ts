/**
 * A message either sent from a thread or to a thread.
 * @type result – a task completed succesfully on the child thread and has a result.
 * @type error – a task failed and has an error message.
 * @type run – A request to run a task on the thread.
 */
export type Message =
    (
        | {
            type: 'result';
            result: unknown;
        }
        | {
            type: 'error';
            error: unknown;
        }
        | {
            type: 'run';
            func: string;
            // These params are the arguments to pass to the func.
            // Listed like: 'argument0': any, 'argument1': any, etc.
            [k: string]: any;
        }
    )
    & {
        id: number;
    };
