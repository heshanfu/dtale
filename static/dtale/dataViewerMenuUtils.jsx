import _ from "lodash";

import { buildURLString } from "../actions/url-utils";
import { fetchJsonPromise, logException } from "../fetcher";

function updateSort(selectedCols, dir, { sortInfo, propagateState }) {
  let updatedSortInfo = _.filter(sortInfo, ([col, _dir]) => !_.includes(selectedCols, col));
  switch (dir) {
    case "ASC":
    case "DESC":
      updatedSortInfo = _.concat(
        updatedSortInfo,
        _.map(selectedCols, col => [col, dir])
      );
      break;
    case "NONE":
    default:
      break;
  }
  propagateState({ sortInfo: updatedSortInfo, triggerResize: true });
}

function buildCallback(route, dataId, params) {
  return () =>
    fetchJsonPromise(buildURLString(`/dtale/${route}/${dataId}?`, params))
      .then(_.noop)
      .catch((e, callstack) => {
        logException(e, callstack);
      });
}

function moveOnePosition(selectedCol, { columns, propagateState, dataId }, action) {
  return () => {
    const locked = _.filter(columns, "locked");
    const nonLocked = _.filter(columns, ({ locked }) => !locked);
    const selectedIdx = _.findIndex(nonLocked, { name: selectedCol });
    if (action === "right" && selectedIdx === nonLocked.length - 1) {
      return;
    }
    if (action === "left" && selectedIdx === 0) {
      return;
    }
    const moveToRightIdx = action === "right" ? selectedIdx : selectedIdx - 1;
    const moveToRight = _.clone(nonLocked[moveToRightIdx]);
    const moveToLeftIdx = action === "right" ? selectedIdx + 1 : selectedIdx;
    const moveToLeft = _.clone(nonLocked[moveToLeftIdx]);
    nonLocked[moveToRightIdx] = moveToLeft;
    nonLocked[moveToLeftIdx] = moveToRight;
    const finalCols = _.concat(locked, nonLocked);
    const callback = buildCallback("update-column-position", dataId, {
      col: selectedCol,
      action,
    });
    propagateState({ columns: finalCols, triggerResize: true }, callback);
  };
}

function moveTo(selectedCol, { columns, propagateState, dataId }, action = "front") {
  return () => {
    const locked = _.filter(columns, "locked");
    const colsToMove = _.filter(columns, ({ name, locked }) => selectedCol === name && !locked);
    let finalCols = _.filter(columns, ({ name }) => selectedCol !== name);
    finalCols = _.filter(finalCols, ({ name }) => !_.find(locked, { name }));
    finalCols = action === "front" ? _.concat(locked, colsToMove, finalCols) : _.concat(locked, finalCols, colsToMove);
    const callback = buildCallback("update-column-position", dataId, {
      col: selectedCol,
      action,
    });
    propagateState({ columns: finalCols, triggerResize: true }, callback);
  };
}

function lockCols(selectedCols, { columns, propagateState, dataId }) {
  return () => {
    let locked = _.filter(columns, "locked");
    locked = _.concat(
      locked,
      _.map(
        _.filter(columns, ({ name }) => _.includes(selectedCols, name)),
        c => _.assignIn({}, c, { locked: true })
      )
    );
    const callback = buildCallback("update-locked", dataId, {
      col: selectedCols[0],
      action: "lock",
    });
    propagateState(
      {
        columns: _.concat(
          locked,
          _.filter(columns, ({ name }) => !_.find(locked, { name }))
        ),
        fixedColumnCount: locked.length,
        selectedCols: [],
        triggerResize: true,
      },
      callback
    );
  };
}

function unlockCols(selectedCols, { columns, propagateState, dataId }) {
  return () => {
    let locked = _.filter(columns, "locked");
    const unlocked = _.map(
      _.filter(locked, ({ name }) => _.includes(selectedCols, name)),
      c => _.assignIn({}, c, { locked: false })
    );
    locked = _.filter(locked, ({ name }) => !_.includes(selectedCols, name));
    const callback = buildCallback("update-locked", dataId, {
      col: selectedCols[0],
      action: "unlock",
    });
    propagateState(
      {
        columns: _.concat(
          locked,
          unlocked,
          _.filter(columns, c => !_.get(c, "locked", false))
        ),
        fixedColumnCount: locked.length,
        selectedCols: [],
        triggerResize: true,
      },
      callback
    );
  };
}

function buildStyling(val, colType, styleProps) {
  const style = {};
  if (!_.isUndefined(val) && !_.isEmpty(styleProps)) {
    if (styleProps.redNegs) {
      switch (colType) {
        case "float":
        case "int":
          style.color = val < 0 ? "red" : "";
          break;
      }
    }
  }
  return style;
}

function fullPath(path, dataId = null) {
  return dataId ? `${path}/${dataId}` : path;
}

function open(path, dataId, height = 450, width = 500) {
  window.open(fullPath(path, dataId), "_blank", `titlebar=1,location=1,status=1,width=${width},height=${height}`);
}

function shouldOpenPopup(height, width) {
  if (global.top === global.self) {
    // not within iframe
    return window.innerWidth < width || window.innerHeight < height;
  }
  return true;
}

export default {
  updateSort,
  moveToFront: (selectedCol, props) => moveTo(selectedCol, props, "front"),
  moveToBack: (selectedCol, props) => moveTo(selectedCol, props, "back"),
  moveRight: (selectedCol, props) => moveOnePosition(selectedCol, props, "right"),
  moveLeft: (selectedCol, props) => moveOnePosition(selectedCol, props, "left"),
  lockCols,
  unlockCols,
  buildStyling,
  fullPath,
  open,
  shouldOpenPopup,
};
