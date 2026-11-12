// Edge 安卓也能从扩展菜单打开主页；tabs.create 无需额外的 tabs 权限。
const extensionApi = typeof browser !== 'undefined' ? browser : chrome;
extensionApi.action.onClicked.addListener(() => {
  extensionApi.tabs.create({ url: extensionApi.runtime.getURL('newtab.html') });
});
