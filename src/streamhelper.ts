// import { FixedBuffer, Repeater } from "@repeaterjs/repeater";
import DataLoader from "dataloader";

export function loadDataLoaderStreaming<TKey, TValue>(
        dataloader: DataLoader<TKey, TValue>,
        keys: () => PromiseLike<readonly TKey[]> | readonly TKey[],
    ) : AsyncIterable<TValue> {
    // TODO: Use repeater for safety & cancelability here somehow - right now this raises a CF error due to some global promise
    // return new Repeater(async (push, stop) => {
    //     const k = await keys();
    //     return await Promise.all(k.map(async key => {
    //         const p = dataloader.load(key);
    //         push(p);
    //         const r = await p;
    //         return r;
    //     }));
    // });
    return async function* () {
        const promises = (await keys()).map(async key => dataloader.load(key));
        for (const p of promises) {
            yield await p;
        }
    }();
}